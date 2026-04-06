import { Webcam } from "@/types";

const WINDY_API_BASE = "https://api.windy.com/webcams/api/v3";

/**
 * Fetch nearby webcams from Windy Webcams API.
 * Requires WINDY_WEBCAMS_API_KEY in env.
 */
export async function fetchWebcams(
  latitude: number,
  longitude: number,
  radiusKm = 50,
  limit = 20
): Promise<Webcam[]> {
  const apiKey = process.env.WINDY_WEBCAMS_API_KEY;
  if (!apiKey) throw new Error("WINDY_WEBCAMS_API_KEY is not set");

  const res = await fetch(
    `${WINDY_API_BASE}/webcams?nearby=${latitude},${longitude},${radiusKm}&limit=${limit}&include=images,player,location`,
    {
      headers: { "x-windy-api-key": apiKey },
    }
  );
  if (!res.ok) throw new Error(`Windy Webcams API error: ${res.status}`);

  const data = await res.json();
  const cams = data.webcams ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return cams.map((cam: Record<string, any>) => ({
    id: cam.webcamId ?? cam.id,
    title: cam.title,
    latitude: cam.location?.latitude ?? latitude,
    longitude: cam.location?.longitude ?? longitude,
    thumbnailUrl: cam.images?.current?.preview ?? "",
    previewUrl: cam.images?.current?.preview ?? undefined,
    playerUrl: cam.player?.day ?? undefined,
    lastUpdated: cam.lastUpdatedOn ?? new Date().toISOString(),
    status: cam.status === "active" ? "active" : "inactive",
    country: cam.location?.country ?? undefined,
    city: cam.location?.city ?? undefined,
  }));
}
