import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TLE_SOURCES = [
  { type: "station", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle" },
  { type: "starlink", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle" },
  { type: "gps", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle" },
  { type: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" },
];

export async function GET() {
  const results: { type: string; tle: string }[] = [];

  await Promise.all(
    TLE_SOURCES.map(async ({ type, url }) => {
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": "GlobeLens/1.0" },
          next: { revalidate: 3600 },
        });
        if (!res.ok) {
          console.error(`[Satellites] CelesTrak ${type} returned ${res.status}`);
          return;
        }
        const text = await res.text();
        results.push({ type, tle: text });
        console.log(`[Satellites] Loaded ${type} TLE data`);
      } catch (err) {
        console.error(`[Satellites] Failed to fetch ${type}:`, err);
      }
    })
  );

  return NextResponse.json(results);
}
