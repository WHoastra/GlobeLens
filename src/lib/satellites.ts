import {
  twoline2satrec,
  propagate,
  eciToGeodetic,
  gstime,
  degreesLong,
  degreesLat,
  SatRec,
} from "satellite.js";

export type SatelliteType = "station" | "starlink" | "gps" | "weather";

export interface SatelliteData {
  name: string;
  noradId: number;
  type: SatelliteType;
  satrec: SatRec;
}

export interface SatellitePosition {
  name: string;
  noradId: number;
  type: SatelliteType;
  latitude: number;
  longitude: number;
  altitude: number; // km
  velocity: number; // km/s
  heading: number; // radians, 0 = north, CW positive
}

const TLE_SOURCES: { type: SatelliteType; url: string }[] = [
  { type: "station", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle" },
  { type: "starlink", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle" },
  { type: "gps", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle" },
  { type: "weather", url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle" },
];

const CACHE_KEY = "globelens_tle_cache";
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/** Parse TLE text into satellite records */
function parseTLE(tleText: string, type: SatelliteType): SatelliteData[] {
  const lines = tleText.trim().split("\n").map((l) => l.trim());
  const satellites: SatelliteData[] = [];

  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i];
    const line1 = lines[i + 1];
    const line2 = lines[i + 2];

    if (!line1?.startsWith("1 ") || !line2?.startsWith("2 ")) continue;

    try {
      const satrec = twoline2satrec(line1, line2);
      const noradId = parseInt(line2.substring(2, 7).trim(), 10);
      satellites.push({ name, noradId, type, satrec });
    } catch {
      // skip malformed TLEs
    }
  }

  return satellites;
}

/** Fetch all TLE data with localStorage caching */
export async function fetchAllSatellites(): Promise<SatelliteData[]> {
  // Check cache
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { timestamp, data } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          // Re-parse TLE strings from cache
          return data.flatMap((entry: { type: SatelliteType; tle: string }) =>
            parseTLE(entry.tle, entry.type)
          );
        }
      }
    } catch {
      // ignore cache errors
    }
  }

  const results: SatelliteData[] = [];
  const cacheEntries: { type: SatelliteType; tle: string }[] = [];

  try {
    // Fetch TLE data through server-side proxy to avoid CelesTrak CORS/blocking issues
    const res = await fetch("/api/satellites");
    if (res.ok) {
      const entries: { type: SatelliteType; tle: string }[] = await res.json();
      for (const { type, tle } of entries) {
        const sats = parseTLE(tle, type);
        results.push(...sats);
        cacheEntries.push({ type, tle });
      }
    }
  } catch {
    // fallback: try direct fetch
    await Promise.all(
      TLE_SOURCES.map(async ({ type, url }) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const text = await res.text();
          const sats = parseTLE(text, type);
          results.push(...sats);
          cacheEntries.push({ type, tle: text });
        } catch {
          // skip failed fetches
        }
      })
    );
  }

  // Save to cache
  if (typeof window !== "undefined" && cacheEntries.length > 0) {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ timestamp: Date.now(), data: cacheEntries })
      );
    } catch {
      // localStorage full — ignore
    }
  }

  return results;
}

/** Calculate current position of a satellite */
export function getSatellitePosition(
  sat: SatelliteData,
  date: Date
): SatellitePosition | null {
  try {
    const posVel = propagate(sat.satrec, date);
    if (typeof posVel.position === "boolean" || !posVel.position) return null;

    const gmst = gstime(date);
    const geo = eciToGeodetic(posVel.position, gmst);

    const velocity =
      posVel.velocity && typeof posVel.velocity !== "boolean"
        ? Math.sqrt(
            posVel.velocity.x ** 2 +
            posVel.velocity.y ** 2 +
            posVel.velocity.z ** 2
          )
        : 0;

    // Compute heading from position delta (look-ahead 10 seconds)
    let heading = 0;
    try {
      const future = new Date(date.getTime() + 10_000);
      const futureVel = propagate(sat.satrec, future);
      if (futureVel.position && typeof futureVel.position !== "boolean") {
        const futureGeo = eciToGeodetic(futureVel.position, gstime(future));
        const dLon = degreesLong(futureGeo.longitude) - degreesLong(geo.longitude);
        const dLat = degreesLat(futureGeo.latitude) - degreesLat(geo.latitude);
        heading = Math.atan2(dLon, dLat); // radians, 0 = north, CW positive
      }
    } catch {
      // heading stays 0
    }

    return {
      name: sat.name,
      noradId: sat.noradId,
      type: sat.type,
      latitude: degreesLat(geo.latitude),
      longitude: degreesLong(geo.longitude),
      altitude: geo.height,
      velocity,
      heading,
    };
  } catch {
    return null;
  }
}

/** Calculate orbital path points for a satellite */
export function getOrbitPath(
  sat: SatelliteData,
  date: Date,
  points = 120,
  periodMinutes = 92 // ~ISS orbital period
): { latitude: number; longitude: number; altitude: number }[] {
  const path: { latitude: number; longitude: number; altitude: number }[] = [];
  const halfPeriod = periodMinutes / 2;

  for (let i = 0; i < points; i++) {
    const minuteOffset = -halfPeriod + (i / points) * periodMinutes;
    const t = new Date(date.getTime() + minuteOffset * 60000);
    const pos = getSatellitePosition(sat, t);
    if (pos) {
      path.push({
        latitude: pos.latitude,
        longitude: pos.longitude,
        altitude: pos.altitude,
      });
    }
  }

  return path;
}

/** ISS NORAD catalog number */
export const ISS_NORAD_ID = 25544;

/** Check if a satellite is the ISS */
export function isISS(sat: SatelliteData): boolean {
  return sat.noradId === ISS_NORAD_ID || sat.name.includes("ISS (ZARYA)");
}
