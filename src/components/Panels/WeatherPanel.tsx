"use client";

import WeatherContent from "@/components/Layers/WeatherPanel";
import type { WeatherData } from "@/types";

interface WeatherPanelProps {
  weather: WeatherData | null;
  loading: boolean;
  error: string | null;
  showLayer: boolean;
  hasActiveData: boolean;
}

export default function WeatherPanel({ weather, loading, error, showLayer, hasActiveData }: WeatherPanelProps) {
  return (
    <div className="space-y-4">
      {showLayer && (
        <div>
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-2">Weather</h4>
          <WeatherContent weather={weather} loading={loading} error={error} />
        </div>
      )}
      {!hasActiveData && (
        <p className="text-sm text-white/40">Enable a layer to see data for this location.</p>
      )}
    </div>
  );
}
