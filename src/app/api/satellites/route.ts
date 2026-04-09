import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// CelesTrak — primary source (returns ALL satellites per group in one request)
const CELESTRAK_SOURCES = [
  { type: "starlink", url: "https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=tle" },
  { type: "starlink", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle" },
  { type: "station", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle" },
  { type: "gps", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle" },
  { type: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" },
];

// TLE.info — fallback when CelesTrak is down
const TLE_API = "https://tle.ivanstanojevic.me/api/tle/";
const TLE_FALLBACK = [
  // Starlink: 20 pages × 100 = up to 2000
  ...Array.from({ length: 20 }, (_, i) => ({
    type: "starlink", search: "STARLINK", page: i + 1, pageSize: 100,
  })),
  { type: "gps", search: "NAVSTAR", page: 1, pageSize: 100 },
  { type: "station", search: "ISS", page: 1, pageSize: 10 },
  { type: "station", search: "TIANGONG", page: 1, pageSize: 5 },
  { type: "weather", search: "NOAA", page: 1, pageSize: 50 },
  { type: "weather", search: "GOES", page: 1, pageSize: 20 },
  { type: "weather", search: "METEOR", page: 1, pageSize: 30 },
];

interface TLEMember { name: string; line1: string; line2: string; }

async function fetchFromCelesTrak(): Promise<{ type: string; tle: string }[]> {
  const buckets: Record<string, string[]> = {};
  const seen = new Set<string>();

  const results = await Promise.allSettled(
    CELESTRAK_SOURCES.map(async ({ type, url }) => {
      const res = await fetch(url, {
        headers: { "User-Agent": "GlobeLens/1.0" },
      });
      if (!res.ok) throw new Error(`CelesTrak ${type}: ${res.status}`);
      const text = await res.text();
      const lines = text.trim().split("\n").map((l) => l.trim());
      const entries: { name: string; line1: string; line2: string; type: string }[] = [];
      for (let i = 0; i < lines.length - 2; i += 3) {
        const name = lines[i];
        const l1 = lines[i + 1];
        const l2 = lines[i + 2];
        if (l1?.startsWith("1 ") && l2?.startsWith("2 ") && !seen.has(name)) {
          seen.add(name);
          entries.push({ name, line1: l1, line2: l2, type });
        }
      }
      return entries;
    })
  );

  for (const result of results) {
    if (result.status !== "fulfilled") {
      console.warn("[Satellites] CelesTrak fetch failed:", result.reason);
      continue;
    }
    for (const m of result.value) {
      if (!buckets[m.type]) buckets[m.type] = [];
      buckets[m.type].push(`${m.name}\n${m.line1}\n${m.line2}`);
    }
  }

  const total = Object.values(buckets).reduce((s, b) => s + b.length, 0);
  if (total > 0) {
    const breakdown = Object.entries(buckets).map(([t, b]) => `${t}:${b.length}`).join(", ");
    console.log(`[Satellites] CelesTrak loaded ${total} satellites (${breakdown})`);
  }

  return Object.entries(buckets).map(([type, lines]) => ({
    type,
    tle: lines.join("\n"),
  }));
}

async function fetchFromTLEInfo(): Promise<{ type: string; tle: string }[]> {
  const buckets: Record<string, string[]> = {};
  const seen = new Set<string>();

  // Fetch in batches of 5 to avoid overwhelming TLE.info
  for (let batch = 0; batch < TLE_FALLBACK.length; batch += 5) {
    const chunk = TLE_FALLBACK.slice(batch, batch + 5);
    const results = await Promise.allSettled(
      chunk.map(async ({ type, search, page, pageSize }) => {
        const url = `${TLE_API}?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`;
        const res = await fetch(url);
        if (!res.ok) return [];
        const data = await res.json();
        return ((data.member || []) as TLEMember[]).map((m) => ({ ...m, type }));
      })
    );

    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const m of result.value) {
        if (seen.has(m.name)) continue;
        seen.add(m.name);
        if (!buckets[m.type]) buckets[m.type] = [];
        buckets[m.type].push(`${m.name}\n${m.line1}\n${m.line2}`);
      }
    }
  }

  const total = Object.values(buckets).reduce((s, b) => s + b.length, 0);
  if (total > 0) {
    const breakdown = Object.entries(buckets).map(([t, b]) => `${t}:${b.length}`).join(", ");
    console.log(`[Satellites] TLE.info loaded ${total} satellites (${breakdown})`);
  }

  return Object.entries(buckets).map(([type, lines]) => ({
    type,
    tle: lines.join("\n"),
  }));
}

export async function GET() {
  // Try CelesTrak first (bulk data, faster)
  let results = await fetchFromCelesTrak();

  if (results.length === 0) {
    console.log("[Satellites] CelesTrak returned nothing, trying TLE.info...");
    results = await fetchFromTLEInfo();
  }

  if (results.length === 0) {
    console.error("[Satellites] All satellite sources failed");
  }

  return NextResponse.json(results);
}
