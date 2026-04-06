import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TLE_API_BASE = "https://tle.ivanstanojevic.me/api/tle/";
const PAGES_TO_FETCH = 5; // 100 per page × 5 = 500 satellites
const PAGE_SIZE = 100;

// CelesTrak as fallback
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

function classifySatellite(name: string): string {
  const upper = name.toUpperCase();
  if (upper.includes("ISS") || upper.includes("ZARYA") || upper.includes("TIANGONG")) return "station";
  if (upper.includes("STARLINK")) return "starlink";
  if (upper.includes("NAVSTAR") || upper.includes("GPS")) return "gps";
  if (upper.includes("NOAA") || upper.includes("GOES") || upper.includes("METEOR") || upper.includes("METEOSAT")) return "weather";
  return "station"; // default bucket
}

async function fetchFromTLEInfo(): Promise<{ type: string; tle: string }[]> {
  const buckets: Record<string, string[]> = {};

  // Fetch top satellites by popularity across multiple pages
  const pagePromises = [];
  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    pagePromises.push(
      fetch(`${TLE_API_BASE}?page_size=${PAGE_SIZE}&page=${page}&sort=popularity&sort-dir=desc`)
        .then(async (res) => {
          if (!res.ok) return [];
          const data = await res.json();
          return (data.member || []) as TLEMember[];
        })
        .catch(() => [] as TLEMember[])
    );
  }

  const pages = await Promise.all(pagePromises);
  let totalCount = 0;

  for (const members of pages) {
    for (const m of members) {
      const type = classifySatellite(m.name);
      if (!buckets[type]) buckets[type] = [];
      buckets[type].push(`${m.name}\n${m.line1}\n${m.line2}`);
      totalCount++;
    }
  }

  console.log(`[Satellites] TLE.info loaded ${totalCount} satellites across ${Object.keys(buckets).length} types`);

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
        const res = await fetch(url, {
          headers: { "User-Agent": "GlobeLens/1.0" },
        });
        if (!res.ok) return;
        const text = await res.text();
        results.push({ type, tle: text });
      } catch {
        // skip
      }
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

  if (results.length === 0) {
    console.error("[Satellites] All TLE sources failed");
  }

  return NextResponse.json(results);
}
