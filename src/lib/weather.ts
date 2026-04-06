import { WeatherData } from "@/types";

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1";

/** WMO weather code → human description */
const WMO_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

/**
 * Fetch current weather for a coordinate pair.
 * Open-Meteo is free and requires no API key.
 */
export async function fetchWeather(
  latitude: number,
  longitude: number,
  locationName = "Unknown"
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current_weather: "true",
    hourly: "relative_humidity_2m,apparent_temperature",
    forecast_days: "1",
  });

  const res = await fetch(`${OPEN_METEO_BASE}/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo API error: ${res.status}`);

  const data = await res.json();
  const cw = data.current_weather;

  // Get humidity and feels-like from the current hour's hourly data
  const currentHour = new Date(cw.time).getHours();
  const humidity = data.hourly?.relative_humidity_2m?.[currentHour] ?? 0;
  const feelsLike = data.hourly?.apparent_temperature?.[currentHour] ?? cw.temperature;

  return {
    latitude,
    longitude,
    locationName,
    temperature: cw.temperature,
    feelsLike,
    humidity,
    windSpeed: cw.windspeed,
    windDirection: cw.winddirection,
    weatherCode: cw.weathercode,
    description: WMO_DESCRIPTIONS[cw.weathercode] ?? "Unknown",
    isDay: cw.is_day === 1,
  };
}
