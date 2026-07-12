import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import type { Launch, LaunchProvider } from "@/types";

export const dynamic = "force-dynamic";

// Launch Library 2 (The Space Devs) — free, no key, ~15 req/hr rate limit,
// so responses are cached to disk and served stale on upstream failure.
const LL2_BASE = "https://ll.thespacedevs.com/2.2.0/launch";

// ── File-based Cache ──────────────────────────────────────────
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "launches.json");

function readCache(ignoreTtl = false): { data: Launch[]; timestamp: number } | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const parsed = JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
    if (ignoreTtl || Date.now() - parsed.timestamp < CACHE_TTL) return parsed;
    return null;
  } catch {
    return null;
  }
}

function writeCache(data: Launch[]) {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {
    // non-critical
  }
}

// ── LL2 response shape (subset) ───────────────────────────────
interface LL2Launch {
  id: string;
  name: string;
  status?: { name?: string; abbrev?: string };
  net?: string;
  window_start?: string;
  window_end?: string;
  launch_service_provider?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  mission?: {
    name?: string;
    description?: string;
    orbit?: { name?: string; abbrev?: string };
  };
  pad?: {
    name?: string;
    latitude?: string;
    longitude?: string;
    location?: { name?: string };
  };
  image?: string;
  webcast_live?: boolean;
  vidURLs?: { url?: string; priority?: number }[];
}

function classifyProvider(lspName: string, rocketName: string): LaunchProvider {
  const s = `${lspName} ${rocketName}`.toLowerCase();
  if (s.includes("spacex") || s.includes("falcon") || s.includes("starship")) return "spacex";
  if (s.includes("nasa") || s.includes("sls")) return "nasa";
  return "other";
}

function toLaunch(l: LL2Launch, upcoming: boolean): Launch | null {
  const lat = parseFloat(l.pad?.latitude ?? "");
  const lon = parseFloat(l.pad?.longitude ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !l.net) return null;

  const lspName = l.launch_service_provider?.name ?? "Unknown";
  const rocketName = l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? "Unknown rocket";
  const webcast = (l.vidURLs ?? []).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))[0]?.url;

  return {
    id: l.id,
    name: l.name,
    rocketName,
    missionName: l.mission?.name,
    missionDescription: l.mission?.description,
    provider: classifyProvider(lspName, rocketName),
    providerName: lspName,
    status: l.status?.name ?? "Unknown",
    statusAbbrev: l.status?.abbrev ?? "TBD",
    net: l.net,
    windowStart: l.window_start,
    windowEnd: l.window_end,
    orbitName: l.mission?.orbit?.name,
    orbitAbbrev: l.mission?.orbit?.abbrev,
    padName: l.pad?.name ?? "Unknown pad",
    padLocation: l.pad?.location?.name ?? "",
    latitude: lat,
    longitude: lon,
    image: l.image,
    webcastUrl: webcast,
    webcastLive: l.webcast_live,
    upcoming,
  };
}

async function fetchLL2(path: string): Promise<LL2Launch[]> {
  const res = await fetch(`${LL2_BASE}${path}`, {
    headers: { "User-Agent": "GlobeLens/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`LL2 ${path}: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []) as LL2Launch[];
}

export async function GET() {
  const cached = readCache();
  if (cached) {
    return NextResponse.json(cached.data);
  }

  try {
    const [upcoming, previous] = await Promise.all([
      fetchLL2("/upcoming/?mode=detailed&limit=30&hide_recent_previous=true"),
      fetchLL2("/previous/?mode=detailed&limit=10"),
    ]);

    const launches: Launch[] = [
      ...upcoming.map((l) => toLaunch(l, true)),
      ...previous.map((l) => toLaunch(l, false)),
    ].filter((l): l is Launch => l !== null);

    if (launches.length > 0) {
      writeCache(launches);
      console.log(`[Launches] LL2 loaded ${launches.length} launches`);
    }
    return NextResponse.json(launches);
  } catch (e) {
    console.warn("[Launches] LL2 fetch failed, serving stale cache if any:", e);
    const stale = readCache(true);
    return NextResponse.json(stale?.data ?? []);
  }
}
