"use client";

import ISSContent from "@/components/Layers/ISSPanel";
import type { ISSInfo } from "@/components/Globe";

interface ISSPanelProps {
  issInfo: ISSInfo | null;
  issLoading: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  showISSOrbit: boolean;
  onOrbitToggle: () => void;
  trackISS: boolean;
  onTrackToggle: () => void;
}

export default function ISSPanel({
  issInfo,
  issLoading,
  expanded,
  onToggleExpand,
  showISSOrbit,
  onOrbitToggle,
  trackISS,
  onTrackToggle,
}: ISSPanelProps) {
  return (
    <div className="rounded-xl border border-yellow-400/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl">
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-yellow-300">International Space Station</h3>
          <span className="text-white/30 text-xs">{expanded ? "▼" : "▶"}</span>
        </button>
        <button
          onClick={onOrbitToggle}
          className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
            showISSOrbit
              ? "border-yellow-400/40 text-yellow-300 bg-yellow-400/10"
              : "border-white/10 text-white/30 hover:text-white/50"
          }`}
          title="Toggle orbit line"
        >
          Orbit
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <ISSContent
            info={issInfo}
            loading={issLoading}
            isTracking={trackISS}
            onTrackToggle={onTrackToggle}
          />
        </div>
      )}
    </div>
  );
}
