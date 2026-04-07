"use client";

import { Newspaper, Cloud, Camera, Car, Satellite } from "lucide-react";
import { LayerState, LayerType, WeatherTileLayerKey, NewsCategory, NEWS_CATEGORIES, SATELLITE_CATEGORIES } from "@/types";

interface LayerToggleProps {
  layers: LayerState;
  onToggle: (layer: LayerType) => void;
  activeWeatherLayers?: WeatherTileLayerKey[];
  onWeatherLayerToggle?: (layer: WeatherTileLayerKey) => void;
  newsCategories?: Set<NewsCategory>;
  onNewsCategoryToggle?: (cat: NewsCategory) => void;
  satelliteTypes?: Set<string>;
  onSatelliteTypeToggle?: (type: string) => void;
}

const WEATHER_TILE_OPTIONS: { key: WeatherTileLayerKey; label: string; color: string }[] = [
  { key: "clouds_new", label: "Clouds", color: "bg-gray-400" },
  { key: "precipitation_new", label: "Rain", color: "bg-blue-400" },
  { key: "temp_new", label: "Temp", color: "bg-orange-400" },
  { key: "wind_new", label: "Wind", color: "bg-teal-400" },
];

const LAYER_CONFIG: { key: LayerType; label: string; icon: typeof Newspaper }[] = [
  { key: "news", label: "News", icon: Newspaper },
  { key: "weather", label: "Weather", icon: Cloud },
  { key: "webcams", label: "Webcams", icon: Camera },
  { key: "traffic", label: "Traffic", icon: Car },
  { key: "satellites", label: "Satellites", icon: Satellite },
];

/* ── Color legend data for each weather layer ─────────── */
const LEGENDS: Record<WeatherTileLayerKey, { label: string; stops: { color: string; text: string }[] }> = {
  clouds_new: {
    label: "Cloud Cover",
    stops: [
      { color: "#ffffff00", text: "Clear" },
      { color: "#c8c8c8", text: "50%" },
      { color: "#ffffff", text: "100%" },
    ],
  },
  precipitation_new: {
    label: "Precipitation (mm/h)",
    stops: [
      { color: "#88bbee", text: "0.5" },
      { color: "#4444ff", text: "4" },
      { color: "#ff0000", text: "12" },
      { color: "#990066", text: "24+" },
    ],
  },
  temp_new: {
    label: "Temperature (\u00B0C)",
    stops: [
      { color: "#9316d1", text: "-40" },
      { color: "#2050ff", text: "-20" },
      { color: "#20ccff", text: "0" },
      { color: "#22cc22", text: "10" },
      { color: "#ffee00", text: "20" },
      { color: "#ff4400", text: "30" },
      { color: "#880000", text: "40+" },
    ],
  },
  wind_new: {
    label: "Wind Speed (m/s)",
    stops: [
      { color: "#ffffff", text: "1" },
      { color: "#aaffaa", text: "5" },
      { color: "#00ff00", text: "15" },
      { color: "#ffff00", text: "25" },
      { color: "#ff0000", text: "50" },
      { color: "#880000", text: "100+" },
    ],
  },
};

export default function LayerToggle({ layers, onToggle, activeWeatherLayers = [], onWeatherLayerToggle, newsCategories, onNewsCategoryToggle, satelliteTypes, onSatelliteTypeToggle }: LayerToggleProps) {
  return (
    <div className="absolute z-10 hidden md:flex md:top-4 md:right-4 md:flex-col md:bg-transparent md:backdrop-blur-none md:border-0 md:overflow-visible md:px-0 md:py-0">
      {LAYER_CONFIG.map(({ key, label, icon: Icon }) => (
        <div key={key}>
          <button
            onClick={() => onToggle(key)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
              transition-all duration-200 backdrop-blur-md border w-full shrink-0 min-h-[44px]
              ${
                layers[key]
                  ? "bg-white/20 border-white/40 text-white shadow-lg shadow-white/10"
                  : "bg-black/30 border-white/10 text-white/50 hover:bg-black/40 hover:text-white/70"
              }`}
            title={`Toggle ${label} layer`}
          >
            <Icon size={16} />
            <span className="hidden md:inline">{label}</span>
          </button>

          {/* News category toggles */}
          {key === "news" && layers.news && newsCategories && onNewsCategoryToggle && (
            <div className="hidden md:flex gap-1 mt-1 ml-1 flex-wrap">
              {NEWS_CATEGORIES.map(({ key: cat, label: catLabel, color }) => {
                const isActive = newsCategories.has(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => onNewsCategoryToggle(cat)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${
                      isActive
                        ? "border-white/30 text-white"
                        : "border-white/10 text-white/30"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} />
                    {catLabel}
                  </button>
                );
              })}
            </div>
          )}

          {/* Satellite type toggles */}
          {key === "satellites" && layers.satellites && satelliteTypes && onSatelliteTypeToggle && (
            <div className="hidden md:flex gap-1 mt-1 ml-1 flex-wrap">
              {SATELLITE_CATEGORIES.map(({ key: satKey, label: satLabel, color }) => {
                const isActive = satelliteTypes.has(satKey);
                return (
                  <button
                    key={satKey}
                    onClick={() => onSatelliteTypeToggle(satKey)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${
                      isActive
                        ? "border-white/30 text-white"
                        : "border-white/10 text-white/30"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.3 }} />
                    {satLabel}
                  </button>
                );
              })}
            </div>
          )}

          {/* Weather sub-layer toggles */}
          {key === "weather" && layers.weather && (
            <div className="hidden md:flex gap-1 mt-1 ml-1 flex-wrap">
              {WEATHER_TILE_OPTIONS.map((opt) => {
                const isActive = activeWeatherLayers.includes(opt.key);
                return (
                  <button
                    key={opt.key}
                    onClick={() => onWeatherLayerToggle?.(opt.key)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all border ${
                      isActive
                        ? "bg-blue-400/20 border-blue-400/40 text-blue-300"
                        : "bg-black/30 border-white/10 text-white/40 hover:text-white/60"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${opt.color} ${isActive ? "opacity-100" : "opacity-40"}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Color legends for active weather layers */}
          {key === "weather" && layers.weather && activeWeatherLayers.length > 0 && (
            <div className="hidden md:flex mt-2 ml-1 flex-col gap-1.5">
              {activeWeatherLayers.map((layerKey) => {
                const legend = LEGENDS[layerKey];
                if (!legend) return null;
                return (
                  <div
                    key={layerKey}
                    className="rounded-lg bg-black/50 backdrop-blur-md border border-white/10 px-2.5 py-1.5"
                  >
                    <p className="text-[9px] text-white/50 font-medium mb-1">{legend.label}</p>
                    <div className="flex items-center gap-0">
                      <div
                        className="h-2 flex-1 rounded-sm"
                        style={{
                          background: `linear-gradient(to right, ${legend.stops.map((s) => s.color).join(", ")})`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      {legend.stops.map((s, i) => (
                        <span key={i} className="text-[8px] text-white/40">{s.text}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
