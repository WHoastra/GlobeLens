import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// TLE.info API — free alternative when CelesTrak is down
const TLE_API_BASE = "https://tle.ivanstanojevic.me/api/tle/";

// NORAD IDs for key satellites to search for
const TLE_SEARCHES = [
  { type: "station", search: "ISS", pageSize: 10 },
  { type: "station", search: "TIANGONG", pageSize: 5 },
  { type: "station", search: "COSMOS", pageSize: 20 },
  { type: "starlink", search: "STARLINK", pageSize: 100 },
  { type: "gps", search: "NAVSTAR", pageSize: 50 },
  { type: "weather", search: "NOAA", pageSize: 20 },
  { type: "weather", search: "METEOR", pageSize: 20 },
  { type: "weather", search: "GOES", pageSize: 10 },
];

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

async function fetchFromTLEInfo(): Promise<{ type: string; tle: string }[]> {
  const results: { type: string; tle: string }[] = [];

  await Promise.all(
    TLE_SEARCHES.map(async ({ type, search, pageSize }) => {
      try {
        const url = `${TLE_API_BASE}?search=${encodeURIComponent(search)}&page_size=${pageSize}`;
        const res = await fetch(url);
        if (!res.ok) {
          console.error(`[Satellites] TLE.info ${search} returned ${res.status}`);
          return;
        }
        const data = await res.json();
        const members: TLEMember[] = data.member || [];

        // Convert JSON TLE data to standard 3-line TLE format
        const tleLines = members
          .map((m: TLEMember) => `${m.name}\n${m.line1}\n${m.line2}`)
          .join("\n");

        if (tleLines) {
          results.push({ type, tle: tleLines });
          console.log(`[Satellites] TLE.info loaded ${members.length} ${search} satellites`);
        }
      } catch (err) {
        console.error(`[Satellites] TLE.info ${search} failed:`, err);
      }
    })
  );

  return results;
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
        console.log(`[Satellites] CelesTrak loaded ${type}`);
      } catch {
        // skip
      }
    })
  );

  return results;
}

export async function GET() {
  // Try TLE.info first (more reliable), fall back to CelesTrak
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
