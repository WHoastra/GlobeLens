"use client";

import { useState } from "react";
import { Cloud, Droplets, Wind, Thermometer } from "lucide-react";
import type { WeatherData } from "@/types";

interface WeatherPanelProps {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
}

function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

export default function WeatherPanel({ weather, loading, error }: WeatherPanelProps) {
  const [unit, setUnit] = useState<"F" | "C">("F");

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <div className="w-4 h-4 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
        Fetching weather...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (!weather) return null;

  const temp = unit === "F" ? cToF(weather.temperature) : weather.temperature;
  const feels = unit === "F" ? cToF(weather.feelsLike) : weather.feelsLike;

  return (
    <div className="space-y-3">
      {/* Main temp + condition */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <p className="text-2xl font-bold">{Math.round(temp)}°{unit}</p>
            <button
              onClick={() => setUnit((u) => u === "F" ? "C" : "F")}
              className="text-xs text-white/40 hover:text-white/70 transition-colors ml-1 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/30"
            >
              °{unit === "F" ? "C" : "F"}
            </button>
          </div>
          <p className="text-sm text-white/60">{weather.description}</p>
        </div>
        <div className="text-right">
          <Cloud size={32} className="text-blue-300 ml-auto" />
          <p className="text-xs text-white/40 mt-1">
            {weather.isDay ? "Day" : "Night"}
          </p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Thermometer size={14} className="text-orange-300" />
          <div>
            <p className="text-xs text-white/40">Feels like</p>
            <p className="text-sm font-medium">{Math.round(feels)}°{unit}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Droplets size={14} className="text-blue-300" />
          <div>
            <p className="text-xs text-white/40">Humidity</p>
            <p className="text-sm font-medium">{weather.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 col-span-2">
          <Wind size={14} className="text-teal-300" />
          <div>
            <p className="text-xs text-white/40">Wind</p>
            <p className="text-sm font-medium">
              {Math.round(weather.windSpeed)} km/h {windDirectionLabel(weather.windDirection)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
