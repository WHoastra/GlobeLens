import { TrafficIncident } from "@/types";

const TOMTOM_API_BASE = "https://api.tomtom.com/traffic";

/**
 * Fetch traffic incidents from TomTom Traffic API.
 * Requires TOMTOM_API_KEY in env.
 */
export async function fetchTrafficIncidents(
  latitude: number,
  longitude: number,
  radiusMeters = 50000
): Promise<TrafficIncident[]> {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) throw new Error("TOMTOM_API_KEY is not set");

  const bbox = getBoundingBox(latitude, longitude, radiusMeters);
  const res = await fetch(
    `${TOMTOM_API_BASE}/services/5/incidentDetails?bbox=${bbox}&key=${apiKey}&fields={incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description},startTime,endTime,from,to}}}&language=en-US&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11,14`
  );
  if (!res.ok) throw new Error(`TomTom API error: ${res.status}`);

  const data = await res.json();
  const incidents = data.incidents ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return incidents.map((inc: Record<string, any>, i: number) => {
    const props = inc.properties ?? {};
    const coords = inc.geometry?.coordinates?.[0] ?? [longitude, latitude];

    return {
      id: props.id ?? `tt-${i}`,
      type: mapIconCategory(props.iconCategory),
      severity: clampSeverity(props.magnitudeOfDelay),
      description: props.events?.map((e: { description: string }) => e.description).join("; ") ?? "Traffic incident",
      latitude: coords[1],
      longitude: coords[0],
      startTime: props.startTime ?? new Date().toISOString(),
      endTime: props.endTime ?? undefined,
      roadName: props.from ?? undefined,
      delay: props.magnitudeOfDelay ?? undefined,
    };
  });
}

function getBoundingBox(lat: number, lon: number, radiusM: number): string {
  const delta = radiusM / 111320;
  return `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
}

function mapIconCategory(cat: number): TrafficIncident["type"] {
  if (cat >= 0 && cat <= 5) return "accident";
  if (cat >= 6 && cat <= 8) return "congestion";
  if (cat >= 9 && cat <= 11) return "construction";
  if (cat === 14) return "event";
  return "other";
}

function clampSeverity(val: number): 1 | 2 | 3 | 4 {
  if (val <= 1) return 1;
  if (val <= 2) return 2;
  if (val <= 3) return 3;
  return 4;
}
