import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const GEOJSON_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson";

const CACHE_DIR = join(process.cwd(), ".cache");
const CACHE_FILE = join(CACHE_DIR, "countries-simplified.geojson");

function readCache(): string | null {
  if (!existsSync(CACHE_FILE)) return null;
  try {
    return readFileSync(CACHE_FILE, "utf-8");
  } catch { /* ignore */ }
  return null;
}

function writeCache(data: string) {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, data);
}

export async function GET() {
  const cached = readCache();
  if (cached) {
    return new NextResponse(cached, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  }

  try {
    const res = await fetch(GEOJSON_URL);
    if (!res.ok) throw new Error(`Failed to fetch GeoJSON: ${res.status}`);

    const geojson = await res.json();

    // Strip down to only the properties Cesium needs
    const simplified = {
      type: "FeatureCollection",
      features: geojson.features.map((f: { type: string; geometry: unknown; properties: Record<string, unknown> }) => ({
        type: f.type,
        geometry: f.geometry,
        properties: {
          ISO_A3: f.properties.ISO_A3 || f.properties.ADM0_A3 || "",
          ISO_A2: f.properties.ISO_A2 || "",
          NAME: f.properties.NAME || f.properties.ADMIN || "",
        },
      })),
    };

    const json = JSON.stringify(simplified);
    writeCache(json);

    return new NextResponse(json, {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
