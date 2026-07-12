import { NextRequest, NextResponse } from "next/server";
import { generateBuoyGrid, type BuoyLocation } from "@/lib/bayouBuoyGrid";
import { generateReading, type NetworkConditions } from "@/lib/bayouBuoySimulator";

type Mode = "normal" | "hurricane" | "spill" | "algal" | "chaos" | "storm-surge";
type Parish = "terrebonne" | "lafourche";

const VALID_MODES: ReadonlySet<Mode> = new Set<Mode>(["normal", "hurricane", "spill", "algal", "chaos", "storm-surge"]);
const VALID_PARISHES: ReadonlySet<Parish> = new Set<Parish>(["terrebonne", "lafourche"]);

const HURRICANE_CENTER = { lat: 28.9, lon: -90.4 };

// Storm surge path — SE entry off Timbalier Bay, eye crosses the bay system at
// mid-cycle, exits NW past Terrebonne Bay. 5-minute cycle so each 30s poll
// advances the eye visibly.
const STORM_PATH = {
  start: { lat: 28.98, lon: -90.05 },
  peak: { lat: 29.1, lon: -90.45 },
  end: { lat: 29.4, lon: -90.85 },
};
const STORM_CYCLE_MS = 300_000;

function computeStormCenter(now: number): { lat: number; lon: number } {
  const phase = (now % STORM_CYCLE_MS) / STORM_CYCLE_MS;
  if (phase < 0.5) {
    const f = phase * 2;
    return {
      lat: STORM_PATH.start.lat + f * (STORM_PATH.peak.lat - STORM_PATH.start.lat),
      lon: STORM_PATH.start.lon + f * (STORM_PATH.peak.lon - STORM_PATH.start.lon),
    };
  }
  const f = (phase - 0.5) * 2;
  return {
    lat: STORM_PATH.peak.lat + f * (STORM_PATH.end.lat - STORM_PATH.peak.lat),
    lon: STORM_PATH.peak.lon + f * (STORM_PATH.end.lon - STORM_PATH.peak.lon),
  };
}

// Module-level cache: the deterministic grid is stable across requests on a warm function.
let cachedGrid: BuoyLocation[] | null = null;
function getGrid(): BuoyLocation[] {
  if (!cachedGrid) cachedGrid = generateBuoyGrid();
  return cachedGrid;
}

function pickStride(ids: string[], count: number, seed: number): string[] {
  if (ids.length === 0 || count <= 0) return [];
  const n = Math.min(count, ids.length);
  const stride = Math.max(1, Math.floor(ids.length / n));
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(ids[(seed + i * stride) % ids.length]);
  }
  return out;
}

// Tight clusters for the demo scenarios, picked by proximity to an anchor point.
const SPILL_ANCHOR = { lat: 29.1, lon: -90.235 }; // east Timbalier Bay, toward Belle Pass / Port Fourchon
const ALGAL_ANCHOR = { lat: 29.13, lon: -90.8 }; // far-west Terrebonne Bay, oyster lease territory

function nearestIds(grid: BuoyLocation[], anchor: { lat: number; lon: number }, count: number): string[] {
  const cosLat = Math.cos((anchor.lat * Math.PI) / 180);
  const d = (b: BuoyLocation) => Math.hypot(b.lat - anchor.lat, (b.lon - anchor.lon) * cosLat);
  return [...grid].sort((a, b) => d(a) - d(b)).slice(0, count).map((b) => b.id);
}

function buildConditions(mode: Mode, grid: BuoyLocation[], now: number): NetworkConditions {
  const dailySeed = Math.floor(now / 86_400_000);

  const spillCandidates = nearestIds(grid, SPILL_ANCHOR, 3);
  const algalCandidates = nearestIds(grid, ALGAL_ANCHOR, 5);

  const allIds = grid.map((b) => b.id);

  switch (mode) {
    case "normal":
      return { hurricaneActive: false };
    case "hurricane":
      return { hurricaneActive: true, hurricaneCenter: HURRICANE_CENTER };
    case "spill":
      return { hurricaneActive: false, spillBuoyIds: spillCandidates };
    case "algal":
      return { hurricaneActive: false, algalBuoyIds: algalCandidates };
    case "chaos":
      return {
        hurricaneActive: true,
        hurricaneCenter: HURRICANE_CENTER,
        spillBuoyIds: spillCandidates,
        algalBuoyIds: algalCandidates,
        offlineBuoyIds: pickStride(allIds, 8, dailySeed),
      };
    case "storm-surge":
      return {
        hurricaneActive: true,
        hurricaneCenter: computeStormCenter(now),
      };
  }
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;

    const modeParam = (params.get("mode") ?? "normal").toLowerCase();
    if (!VALID_MODES.has(modeParam as Mode)) {
      return NextResponse.json(
        { error: "invalid mode", details: `mode must be one of: ${Array.from(VALID_MODES).join(", ")}` },
        { status: 400 },
      );
    }
    const mode = modeParam as Mode;

    const tParam = params.get("t");
    let now: number;
    if (tParam !== null) {
      const parsed = Number.parseInt(tParam, 10);
      if (!Number.isFinite(parsed) || parsed < 0) {
        return NextResponse.json(
          { error: "invalid t", details: "t must be a non-negative integer (unix ms)" },
          { status: 400 },
        );
      }
      now = parsed;
    } else {
      now = Date.now();
    }

    const parishParam = params.get("parish")?.toLowerCase() ?? null;
    if (parishParam !== null && !VALID_PARISHES.has(parishParam as Parish)) {
      return NextResponse.json(
        { error: "invalid parish", details: `parish must be one of: ${Array.from(VALID_PARISHES).join(", ")}` },
        { status: 400 },
      );
    }

    const grid = getGrid();
    const conditions = buildConditions(mode, grid, now);

    let buoys: BuoyLocation[] = grid;
    if (parishParam === "terrebonne") buoys = grid.filter((b) => b.parish === "Terrebonne");
    else if (parishParam === "lafourche") buoys = grid.filter((b) => b.parish === "Lafourche");

    let oilCount = 0;
    let algalCount = 0;
    let offlineCount = 0;

    const merged = buoys.map((buoy) => {
      const r = generateReading(buoy, now, conditions);
      if (r.oilAlert) oilCount++;
      if (r.algalAlert) algalCount++;
      if (!r.online) offlineCount++;

      // Strip buoyId (= id) and timestamp (= top-level) to keep payload tight.
      return {
        id: buoy.id,
        parish: buoy.parish,
        lat: buoy.lat,
        lon: buoy.lon,
        basin: buoy.basin,
        deployedDate: buoy.deployedDate,
        distanceFromGulfKm: buoy.distanceFromGulfKm,
        airTempC: r.airTempC,
        humidity: r.humidity,
        barometricMb: r.barometricMb,
        windSpeedKts: r.windSpeedKts,
        windDirDeg: r.windDirDeg,
        rainfallMmHr: r.rainfallMmHr,
        waterTempC: r.waterTempC,
        pressureMbar: r.pressureMbar,
        depthM: r.depthM,
        salinityPpt: r.salinityPpt,
        conductivityMs: r.conductivityMs,
        dissolvedOxygenMgL: r.dissolvedOxygenMgL,
        turbidityNtu: r.turbidityNtu,
        pH: r.pH,
        orpMv: r.orpMv,
        oilFluorescencePpb: r.oilFluorescencePpb,
        chlorophyllUgL: r.chlorophyllUgL,
        currentSpeedMs: r.currentSpeedMs,
        currentDirDeg: r.currentDirDeg,
        waveHeightFt: r.waveHeightFt,
        wavePeriodS: r.wavePeriodS,
        batteryPct: r.batteryPct,
        signalDbm: r.signalDbm,
        solarChargeW: r.solarChargeW,
        hurricaneMode: r.hurricaneMode,
        oilAlert: r.oilAlert,
        algalAlert: r.algalAlert,
        online: r.online,
      };
    });

    return NextResponse.json(
      {
        mode,
        timestamp: now,
        buoyCount: merged.length,
        alerts: {
          oil: oilCount,
          algal: algalCount,
          hurricane: conditions.hurricaneActive,
          offline: offlineCount,
        },
        buoys: merged,
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (e) {
    const details = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "internal server error", details },
      { status: 500 },
    );
  }
}
