"use client";

import { useState } from "react";
import { X, Droplets, Wind } from "lucide-react";
import type { SearchWeatherData } from "@/types";

const WEATHER_ICONS: Record<number, string> = {
  0: "\u2600\uFE0F", 1: "\u26C5", 2: "\u26C5", 3: "\u2601\uFE0F",
  45: "\uD83C\uDF2B\uFE0F", 48: "\uD83C\uDF2B\uFE0F",
  51: "\uD83C\uDF26\uFE0F", 53: "\uD83C\uDF26\uFE0F", 55: "\uD83C\uDF26\uFE0F",
  61: "\uD83C\uDF27\uFE0F", 63: "\uD83C\uDF27\uFE0F", 65: "\uD83C\uDF27\uFE0F",
  71: "\uD83C\uDF28\uFE0F", 73: "\uD83C\uDF28\uFE0F", 75: "\uD83C\uDF28\uFE0F", 77: "\uD83C\uDF28\uFE0F",
  80: "\uD83C\uDF27\uFE0F", 81: "\uD83C\uDF27\uFE0F", 82: "\uD83C\uDF27\uFE0F",
  85: "\uD83C\uDF28\uFE0F", 86: "\uD83C\uDF28\uFE0F",
  95: "\u26C8\uFE0F", 96: "\u26C8\uFE0F", 99: "\u26C8\uFE0F",
};

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

function getDayName(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  const date = new Date(dateStr + "T12:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

interface WeatherCardProps {
  weather: SearchWeatherData;
  onClose: () => void;
}

export default function WeatherCard({ weather, onClose }: WeatherCardProps) {
  const [unit, setUnit] = useState<"F" | "C">("F");
  const t = (c: number) => Math.round(unit === "F" ? cToF(c) : c);

  return (
    <div className="rounded-xl bg-black/70 backdrop-blur-xl border border-white/10 text-white shadow-2xl p-4 w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-white/40 mb-0.5">{weather.locationName}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{t(weather.temperature)}\u00B0{unit}</span>
            <button
              onClick={() => setUnit((u) => u === "F" ? "C" : "F")}
              className="text-[10px] text-white/40 hover:text-white/70 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/30 transition-colors"
            >
              \u00B0{unit === "F" ? "C" : "F"}
            </button>
          </div>
          <p className="text-sm text-white/60 mt-0.5">
            <span className="mr-1">{WEATHER_ICONS[weather.weatherCode] || "\u2600\uFE0F"}</span>
            {weather.description}
          </p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X size={16} className="text-white/50" />
        </button>
      </div>

      {/* Current details */}
      <div className="flex gap-4 text-xs text-white/50 mb-4">
        <div className="flex items-center gap-1">
          <Droplets size={12} className="text-blue-300" />
          {weather.humidity}%
        </div>
        <div className="flex items-center gap-1">
          <Wind size={12} className="text-teal-300" />
          {Math.round(weather.windSpeed)} km/h
        </div>
        <div>Feels {t(weather.feelsLike)}\u00B0</div>
      </div>

      {/* 7-day forecast */}
      {weather.daily && weather.daily.length > 0 && (
        <div>
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">7-Day Forecast</p>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {weather.daily.map((day, i) => (
              <div
                key={day.date}
                className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg bg-white/5 min-w-[56px] shrink-0"
              >
                <span className="text-[10px] text-white/50">{getDayName(day.date, i)}</span>
                <span className="text-lg">{WEATHER_ICONS[day.weatherCode] || "\u2600\uFE0F"}</span>
                <div className="text-[10px]">
                  <span className="text-white font-medium">{t(day.temperatureMax)}\u00B0</span>
                  <span className="text-white/40 ml-0.5">{t(day.temperatureMin)}\u00B0</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
