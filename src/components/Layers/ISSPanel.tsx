"use client";

import { Orbit, Users, MapPin, Gauge, ExternalLink, Crosshair } from "lucide-react";
import type { ISSInfo } from "@/lib/satelliteManager";
import { formatCoordinates } from "@/lib/geocode";

interface ISSPanelProps {
  info: ISSInfo | null;
  loading: boolean;
  isTracking: boolean;
  onTrackToggle: () => void;
}

export default function ISSPanel({ info, loading, isTracking, onTrackToggle }: ISSPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <div className="w-4 h-4 border-2 border-white/20 border-t-yellow-400 rounded-full animate-spin" />
        Loading ISS data...
      </div>
    );
  }

  if (!info) return null;

  const { position, crewCount, crewNames } = info;
  const speedKmh = Math.round(position.velocity * 3600);

  return (
    <div className="space-y-3">
      {/* Track ISS button */}
      <button
        onClick={onTrackToggle}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
          isTracking
            ? "bg-yellow-500/20 border-yellow-400/40 text-yellow-300"
            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
        }`}
      >
        <Crosshair size={14} />
        {isTracking ? "Stop Tracking" : "Track ISS"}
      </button>

      {/* Position & altitude */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <MapPin size={14} className="text-yellow-300" />
          <div>
            <p className="text-xs text-white/40">Position</p>
            <p className="text-xs font-medium">{formatCoordinates(position.latitude, position.longitude)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Orbit size={14} className="text-blue-300" />
          <div>
            <p className="text-xs text-white/40">Altitude</p>
            <p className="text-sm font-medium">{Math.round(position.altitude)} km</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Gauge size={14} className="text-green-300" />
          <div>
            <p className="text-xs text-white/40">Speed</p>
            <p className="text-sm font-medium">{speedKmh.toLocaleString()} km/h</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Users size={14} className="text-purple-300" />
          <div>
            <p className="text-xs text-white/40">Crew</p>
            <p className="text-sm font-medium">{crewCount ?? "?"} onboard</p>
          </div>
        </div>
      </div>

      {/* Crew names */}
      {crewNames.length > 0 && (
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <p className="text-xs text-white/40 mb-1">Crew Members</p>
          <div className="flex flex-wrap gap-1">
            {crewNames.map((name) => (
              <span key={name} className="text-xs bg-white/10 rounded px-1.5 py-0.5">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* NASA live stream link */}
      <a
        href="https://www.nasa.gov/nasalive"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
      >
        <ExternalLink size={12} />
        Watch NASA ISS Live Stream
      </a>
    </div>
  );
}
