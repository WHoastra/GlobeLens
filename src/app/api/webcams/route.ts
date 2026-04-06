import { NextRequest, NextResponse } from "next/server";
import { fetchWebcams } from "@/lib/webcams";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  const radius = parseFloat(searchParams.get("radius") ?? "100");
  const limit = parseInt(searchParams.get("limit") ?? "50", 10);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    const webcams = await fetchWebcams(lat, lon, radius, limit);
    return NextResponse.json(webcams);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
