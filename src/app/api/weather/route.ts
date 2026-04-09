import { NextRequest, NextResponse } from "next/server";
import { fetchWeather, fetchWeatherWithForecast } from "@/lib/weather";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lon = parseFloat(searchParams.get("lon") ?? "");
  const forecast = searchParams.get("forecast");
  const name = searchParams.get("name") ?? "Unknown";

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "lat and lon are required" }, { status: 400 });
  }

  try {
    const weather = forecast === "7"
      ? await fetchWeatherWithForecast(lat, lon, name)
      : await fetchWeather(lat, lon);
    return NextResponse.json(weather);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
