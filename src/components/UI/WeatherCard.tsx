"use client";

import { useState } from "react";
import { X, Droplets, Wind } from "lucide-react";
import type { SearchWeatherData, NewsArticle } from "@/types";
import { NEWS_CATEGORIES } from "@/types";

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️", 1: "⛅", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌦️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "🌨️", 77: "🌨️",
  80: "🌧️", 81: "🌧️", 82: "🌧️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
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
  nearbyNews?: NewsArticle[];
  onNewsClick?: (article: NewsArticle) => void;
}

export default function WeatherCard({ weather, onClose, nearbyNews, onNewsClick }: WeatherCardProps) {
  const [unit, setUnit] = useState<"F" | "C">("F");
  const temp = (c: number) => Math.round(unit === "F" ? cToF(c) : c);

  return (
    <div className="rounded-xl bg-black/70 backdrop-blur-xl border border-white/10 text-white shadow-2xl p-4 w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs text-white/40 mb-0.5">{weather.locationName}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">{temp(weather.temperature)}°{unit}</span>
            <button
              onClick={() => setUnit((u) => u === "F" ? "C" : "F")}
              className="text-[10px] text-white/40 hover:text-white/70 px-1.5 py-0.5 rounded border border-white/10 hover:border-white/30 transition-colors"
            >
              °{unit === "F" ? "C" : "F"}
            </button>
          </div>
          <p className="text-sm text-white/60 mt-0.5">
            <span className="mr-1">{WEATHER_ICONS[weather.weatherCode] || "☀️"}</span>
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
        <div>Feels {temp(weather.feelsLike)}°</div>
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
                <span className="text-lg">{WEATHER_ICONS[day.weatherCode] || "☀️"}</span>
                <div className="text-[10px]">
                  <span className="text-white font-medium">{temp(day.temperatureMax)}°</span>
                  <span className="text-white/40 ml-0.5">{temp(day.temperatureMin)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nearby news */}
      {nearbyNews && nearbyNews.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Nearby News</p>
          <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
            {nearbyNews.map((article) => {
              const cat = NEWS_CATEGORIES.find((c) => c.key === article.category);
              return (
                <button
                  key={article.id}
                  onClick={() => onNewsClick?.(article)}
                  className="flex items-start gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left w-full"
                >
                  <span
                    className="w-2 h-2 rounded-full mt-1 shrink-0"
                    style={{ backgroundColor: cat?.color || "#fff" }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-white/80 leading-tight line-clamp-2">{article.title}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{article.source}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
