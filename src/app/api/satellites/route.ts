import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TLE_API = "https://tle.ivanstanojevic.me/api/tle/";

// Targeted searches per satellite type — more Starlink, less others
const TYPE_SEARCHES = [
  // Starlink: 5 pages × 100 = up to 500
  ...Array.from({ length: 5 }, (_, i) => ({
    type: "starlink", search: "STARLINK", page: i + 1, pageSize: 100,
  })),
  // GPS/Navigation
  { type: "gps", search: "NAVSTAR", page: 1, pageSize: 100 },
  // Space stations
  { type: "station", search: "ISS", page: 1, pageSize: 10 },
  { type: "station", search: "TIANGONG", page: 1, pageSize: 5 },
  // Weather
  { type: "weather", search: "NOAA", page: 1, pageSize: 50 },
  { type: "weather", search: "GOES", page: 1, pageSize: 20 },
  { type: "weather", search: "METEOR", page: 1, pageSize: 30 },
];

// CelesTrak fallback
const CELESTRAK_SOURCES = [
  { type: "station", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle" },
  { type: "starlink", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle" },
  { type: "gps", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle" },
  { type: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" },
];

interface TLEMember {
  name: string;
  line1: string;
  line2: string;
}

async function fetchFromTLEInfo(): Promise<{ type: string; tle: string }[]> {
  const buckets: Record<string, string[]> = {};
  const seen = new Set<string>(); // deduplicate by name

  const results = await Promise.allSettled(
    TYPE_SEARCHES.map(async ({ type, search, page, pageSize }) => {
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

  const total = Object.values(buckets).reduce((s, b) => s + b.length, 0);
  const breakdown = Object.entries(buckets).map(([t, b]) => `${t}:${b.length}`).join(", ");
  console.log(`[Satellites] TLE.info loaded ${total} satellites (${breakdown})`);

  return Object.entries(buckets).map(([type, lines]) => ({
    type,
    tle: lines.join("\n"),
  }));
}

async function fetchFromCelesTrak(): Promise<{ type: string; tle: string }[]> {
  const results: { type: string; tle: string }[] = [];
  await Promise.all(
    CELESTRAK_SOURCES.map(async ({ type, url }) => {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "GlobeLens/1.0" } });
        if (!res.ok) return;
        results.push({ type, tle: await res.text() });
      } catch { /* skip */ }
    })
  );
  return results;
}

export async function GET() {
  let results = await fetchFromTLEInfo();

  if (results.length === 0) {
    console.log("[Satellites] TLE.info returned nothing, trying CelesTrak...");
    results = await fetchFromCelesTrak();
  }

  return NextResponse.json(results);
}
