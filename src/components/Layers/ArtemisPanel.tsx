"use client";

import { useState } from "react";
import { Rocket, MapPin, Moon, Clock, Users, ExternalLink, Crosshair, Play, X } from "lucide-react";
import type { ArtemisInfo } from "@/lib/satelliteManager";
import { ARTEMIS_STREAM_URL, ARTEMIS_STREAM_EMBED } from "@/lib/artemis";

interface ArtemisPanelProps {
  info: ArtemisInfo | null;
  isTracking: boolean;
  onTrackToggle: () => void;
}

export default function ArtemisPanel({ info, isTracking, onTrackToggle }: ArtemisPanelProps) {
  const [showStream, setShowStream] = useState(false);
  if (!info) {
    return <p className="text-sm text-white/40">Awaiting launch data...</p>;
  }

  return (
    <div className="space-y-3">
      {/* Mission phase */}
      <div className="rounded-lg bg-orange-500/10 border border-orange-400/20 px-3 py-2">
        <p className="text-xs text-orange-300/60 uppercase tracking-wide">Phase</p>
        <p className="text-sm font-semibold text-orange-300">{info.phase}</p>
      </div>

      {/* Track button */}
      <button
        onClick={onTrackToggle}
        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
          isTracking
            ? "bg-orange-500/20 border-orange-400/40 text-orange-300"
            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
        }`}
      >
        <Crosshair size={14} />
        {isTracking ? "Stop Tracking" : "Track Artemis II"}
      </button>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Clock size={14} className="text-orange-300" />
          <div>
            <p className="text-xs text-white/40">MET</p>
            <p className="text-sm font-mono font-medium">{info.met}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <MapPin size={14} className="text-blue-300" />
          <div>
            <p className="text-xs text-white/40">From Earth</p>
            <p className="text-sm font-medium">{formatDistance(info.distanceFromEarthKm)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Moon size={14} className="text-gray-300" />
          <div>
            <p className="text-xs text-white/40">From Moon</p>
            <p className="text-sm font-medium">{formatDistance(info.distanceFromMoonKm)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
          <Rocket size={14} className="text-yellow-300" />
          <div>
            <p className="text-xs text-white/40">Moon Distance</p>
            <p className="text-sm font-medium">{formatDistance(info.moonDistanceKm)}</p>
          </div>
        </div>
      </div>

      {/* Crew */}
      <div className="rounded-lg bg-white/5 px-3 py-2">
        <div className="flex items-center gap-1.5 mb-1.5">
          <Users size={12} className="text-purple-300" />
          <p className="text-xs text-white/40">Crew — 4 Astronauts</p>
        </div>
        <div className="space-y-1">
          {info.crew.map((c) => (
            <div key={c.name} className="flex items-center justify-between text-xs">
              <span className="font-medium">{c.name}</span>
              <span className="text-white/30">{c.role}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Status badge */}
      {info.missionComplete && (
        <div className="rounded-lg bg-green-500/10 border border-green-400/20 px-3 py-2 text-center">
          <p className="text-xs text-green-400 font-semibold">Mission Complete — Historical View</p>
        </div>
      )}

      {/* Stream toggle + external link */}
      {showStream ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide">NASA Artemis II Live</span>
            <button onClick={() => setShowStream(false)} className="p-1 rounded hover:bg-white/10">
              <X size={14} className="text-white/50" />
            </button>
          </div>
          <div className="relative w-full rounded-lg overflow-hidden" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={ARTEMIS_STREAM_EMBED}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
          <a
            href={ARTEMIS_STREAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[10px] text-white/50 hover:text-white/70 transition-colors"
          >
            <ExternalLink size={10} />
            Open on YouTube
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowStream(true)}
            className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Play size={12} />
            Watch NASA Artemis II Live
          </button>
          <a
            href={ARTEMIS_STREAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-white/50 transition-colors"
            title="Open on YouTube"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      )}
    </div>
  );
}

function formatDistance(km: number): string {
  if (km > 10000) return `${Math.round(km).toLocaleString()} km`;
  return `${Math.round(km).toLocaleString()} km`;
}
