import type { BuoyLocation } from './bayouBuoyGrid';

export interface BuoyReading {
  buoyId: string;
  timestamp: number;
  // Atmospheric
  airTempC: number;
  humidity: number;
  barometricMb: number;
  windSpeedKts: number;
  windDirDeg: number;
  rainfallMmHr: number;
  // Subsea
  waterTempC: number;
  pressureMbar: number;
  depthM: number;
  salinityPpt: number;
  conductivityMs: number;
  dissolvedOxygenMgL: number;
  turbidityNtu: number;
  pH: number;
  orpMv: number;
  oilFluorescencePpb: number;
  chlorophyllUgL: number;
  currentSpeedMs: number;
  currentDirDeg: number;
  // Derived
  waveHeightFt: number;
  wavePeriodS: number;
  // Status
  batteryPct: number;
  signalDbm: number;
  solarChargeW: number;
  // Health flags
  hurricaneMode: boolean;
  oilAlert: boolean;
  algalAlert: boolean;
  online: boolean;
}

export interface NetworkConditions {
  hurricaneActive: boolean;
  hurricaneCenter?: { lat: number; lon: number };
  spillBuoyIds?: string[];
  algalBuoyIds?: string[];
  offlineBuoyIds?: string[];
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const M2_PERIOD_HOURS = 12.42;
const LOCAL_UTC_OFFSET_HOURS = 6; // Louisiana CST

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h = h | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const aLat = a.lat * Math.PI / 180;
  const bLat = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function dayOfYearFraction(now: number): number {
  const d = new Date(now);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return (now - yearStart) / DAY_MS / 365;
}

function localHour(now: number): number {
  return (((now / HOUR_MS) - LOCAL_UTC_OFFSET_HOURS) % 24 + 24) % 24;
}

export function generateReading(
  buoy: BuoyLocation,
  now: number,
  conditions: NetworkConditions,
): BuoyReading {
  const minuteSlot = Math.floor(now / 60_000);
  const seed = hashString(`${buoy.id}:${minuteSlot}`);
  const rng = mulberry32(seed);
  // Stable per-buoy "personality" — independent of time
  const personality = mulberry32(hashString(`${buoy.id}:personality`));
  const personalityVals = {
    depthOffset: personality() * 6 - 1, // -1 to +5 m extra depth
    batteryBase: 88 + personality() * 11, // 88-99 %
    solarPeak: 3 + personality() * 1.5, // 3.0-4.5 W
    signalNoise: (personality() - 0.5) * 4,
  };

  const hurricane = conditions.hurricaneActive;
  const spillAffected = (conditions.spillBuoyIds ?? []).includes(buoy.id);
  const algalAffected = (conditions.algalBuoyIds ?? []).includes(buoy.id);
  const isOffline = (conditions.offlineBuoyIds ?? []).includes(buoy.id);

  // ── Tide (M2 lunar semidiurnal) ─────────────────────────
  const tideHours = (now / HOUR_MS) % M2_PERIOD_HOURS;
  const tideFrac = tideHours / M2_PERIOD_HOURS;
  const tideElev = Math.sin(2 * Math.PI * tideFrac); // -1..1
  const tideRate = Math.cos(2 * Math.PI * tideFrac); // derivative — peaks at mid-tide

  const baseDepth = 2.5 + personalityVals.depthOffset;
  // Storm surge — water level rises near a hurricane's eye, falls off with distance
  let surgeM = 0;
  if (hurricane && conditions.hurricaneCenter) {
    const dKm = haversineKm(buoy, conditions.hurricaneCenter);
    const surgeScale = Math.max(0, 1 - dKm / 80); // 0..1, 0 at >=80km, 1 at center
    surgeM = surgeScale * surgeScale * (1.6 + rng() * 1.0); // squared falloff, peak ~2.6m
  }
  const depthM = round2(clamp(baseDepth + 0.5 * tideElev + surgeM + (rng() - 0.5) * 0.05, 0.5, 30));

  // ── Salinity (gulf-distance gradient) ──────────────────
  const dGulf = buoy.distanceFromGulfKm;
  let baseSalinity: number;
  if (dGulf >= 50) baseSalinity = 1.5;
  else if (dGulf <= 5) baseSalinity = 34;
  else baseSalinity = 34 + (1.5 - 34) * ((dGulf - 5) / 45);
  const salinityPpt = round2(clamp(baseSalinity + (rng() - 0.5) * 3, 0, 38));

  // ── Water temperature (seasonal + diurnal + depth swing) ─
  const dayFrac = dayOfYearFraction(now);
  const seasonal = 24 + 6 * Math.sin(2 * Math.PI * (dayFrac - 120 / 365));
  const hour = localHour(now);
  const diurnalWater = 0.5 * Math.sin(2 * Math.PI * (hour - 14) / 24);
  const shallowSwing = depthM < 3 ? 3 * Math.sin(2 * Math.PI * (hour - 15) / 24) : 0;
  const waterTempC = round2(seasonal + diurnalWater + shallowSwing + (rng() - 0.5) * 4);

  // ── Air temperature (relative to water, day/night cycle) ─
  const dayCycle = Math.sin(2 * Math.PI * (hour - 9) / 24); // peaks ~3pm
  const airOffset = 0.75 + 2.75 * dayCycle + (rng() - 0.5) * 1.5;
  const airTempC = round2(waterTempC + airOffset);

  // ── Humidity (high near gulf, lower morning) ────────────
  const baseHumidity = 78 - 5 * dayCycle + (50 - dGulf) / 5;
  const humidity = round2(clamp(baseHumidity + (rng() - 0.5) * 8, 30, 100));

  // ── Wind (hurricane vs normal) ──────────────────────────
  let windSpeedKts: number;
  let windDirDeg: number;
  if (hurricane) {
    windSpeedKts = 35 + rng() * 40;
    if (conditions.hurricaneCenter) {
      const dy = buoy.lat - conditions.hurricaneCenter.lat;
      const dx = (buoy.lon - conditions.hurricaneCenter.lon)
        * Math.cos(buoy.lat * Math.PI / 180);
      const bearing = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      // Cyclonic CCW: wind comes from bearing+90 (compass FROM direction)
      windDirDeg = (bearing + 90 + (rng() - 0.5) * 20 + 360) % 360;
    } else {
      windDirDeg = rng() * 360;
    }
  } else {
    windSpeedKts = 3 + rng() * 9;
    // Prevailing southerly in coastal LA, drifts with personality
    windDirDeg = (160 + personality() * 60 + (rng() - 0.5) * 40 + 360) % 360;
  }
  windSpeedKts = round2(windSpeedKts);
  windDirDeg = Math.round(windDirDeg);

  // ── Barometric pressure ─────────────────────────────────
  let barometricMb: number;
  if (hurricane && conditions.hurricaneCenter) {
    const dKm = haversineKm(buoy, conditions.hurricaneCenter);
    const t = clamp(dKm / 200, 0, 1);
    barometricMb = 985 + 20 * t + (rng() - 0.5) * 2;
  } else if (hurricane) {
    barometricMb = 985 + rng() * 20;
  } else {
    barometricMb = 1013 + rng() * 5;
  }
  barometricMb = round2(barometricMb);

  // ── Rainfall (light unless hurricane / squall) ──────────
  let rainfallMmHr: number;
  if (hurricane) {
    rainfallMmHr = 8 + rng() * 22;
  } else {
    // 90% dry, 10% light shower
    rainfallMmHr = rng() < 0.9 ? 0 : rng() * 4;
  }
  rainfallMmHr = round2(rainfallMmHr);

  // ── Hydrostatic pressure (water column only) ───────────
  const pressureMbar = round2(depthM * 98.1 + (rng() - 0.5) * 1);

  // ── Conductivity (salinity + temperature) ──────────────
  const conductivityMs = round2(
    clamp(0.5 + salinityPpt * 1.45 + waterTempC * 0.05 + (rng() - 0.5) * 0.4, 0, 65)
  );

  // ── Dissolved oxygen ───────────────────────────────────
  const dissolvedOxygenMgL = round2(
    algalAffected ? 3 + rng() * 2 : 6.5 + rng() * 2
  );

  // ── Chlorophyll ─────────────────────────────────────────
  const chlorophyllUgL = round2(
    algalAffected ? 18 + rng() * 17 : 1 + rng() * 4
  );

  // ── Oil fluorescence ────────────────────────────────────
  const oilFluorescencePpb = round2(
    spillAffected ? 180 + rng() * 100 : 5 + rng() * 25
  );

  // ── pH ──────────────────────────────────────────────────
  const pH = round2(
    algalAffected ? 7.4 + rng() * 0.3 : 7.8 + rng() * 0.4
  );

  // ── Turbidity ───────────────────────────────────────────
  let turbidityNtu: number;
  if (spillAffected) turbidityNtu = 80 + rng() * 120;
  else if (hurricane) turbidityNtu = 40 + rng() * 80;
  else turbidityNtu = 5 + rng() * 20;
  turbidityNtu = round2(turbidityNtu);

  // ── ORP ────────────────────────────────────────────────
  const orpMv = Math.round(
    algalAffected ? 100 + rng() * 100 : 200 + rng() * 200
  );

  // ── Currents (tidal cycle, basin-aligned direction) ────
  const currentSpeedMs = round2(
    clamp(0.1 + 0.5 * Math.abs(tideRate) + (rng() - 0.5) * 0.1, 0, 1.5)
  );
  // Flood ~120° (NW->SE inflow), ebb ~300° (reverse), with per-buoy drift
  const baseDir = tideRate > 0 ? 120 : 300;
  const currentDirDeg = Math.round(
    (baseDir + (personality() - 0.5) * 30 + (rng() - 0.5) * 15 + 360) % 360
  );

  // ── Waves ──────────────────────────────────────────────
  let waveHeightFt: number;
  let wavePeriodS: number;
  if (hurricane) {
    waveHeightFt = 4 + rng() * 5;
    wavePeriodS = 7 + rng() * 5;
  } else {
    const base = 0.3 + (windSpeedKts - 3) / 9 * 1.2;
    waveHeightFt = clamp(base + (rng() - 0.5) * 0.4, 0.2, 3);
    wavePeriodS = 2 + (waveHeightFt / 1.5) * 3 + (rng() - 0.5) * 0.6;
  }
  waveHeightFt = round2(waveHeightFt);
  wavePeriodS = round2(wavePeriodS);

  // ── Battery ────────────────────────────────────────────
  let batteryPct = personalityVals.batteryBase + (rng() - 0.5) * 1.5;
  if (hurricane) batteryPct -= 3 + rng() * 2;
  batteryPct = round2(clamp(batteryPct, 0, 100));

  // ── Signal (further from coast = weaker) ───────────────
  const signalT = clamp(buoy.distanceFromGulfKm / 75, 0, 1);
  const signalDbm = Math.round(
    clamp(-95 + 30 * signalT + personalityVals.signalNoise + (rng() - 0.5) * 4, -110, -50)
  );

  // ── Solar charge (sun cycle) ───────────────────────────
  const solarCycle = Math.max(0, Math.sin(Math.PI * (hour - 6) / 12));
  const solarChargeW = round2(
    clamp(solarCycle * personalityVals.solarPeak + (rng() - 0.5) * 0.2, 0, 5)
  );

  // ── Flags ──────────────────────────────────────────────
  const hurricaneMode = hurricane;
  const oilAlert = oilFluorescencePpb > 200;
  const algalAlert = chlorophyllUgL > 15;
  const online = !isOffline;

  return {
    buoyId: buoy.id,
    timestamp: now,
    airTempC,
    humidity,
    barometricMb,
    windSpeedKts,
    windDirDeg,
    rainfallMmHr,
    waterTempC,
    pressureMbar,
    depthM,
    salinityPpt,
    conductivityMs,
    dissolvedOxygenMgL,
    turbidityNtu,
    pH,
    orpMv,
    oilFluorescencePpb,
    chlorophyllUgL,
    currentSpeedMs,
    currentDirDeg,
    waveHeightFt,
    wavePeriodS,
    batteryPct,
    signalDbm,
    solarChargeW,
    hurricaneMode,
    oilAlert,
    algalAlert,
    online,
  };
}
