"use client";

import ArtemisContent from "@/components/Layers/ArtemisPanel";
import type { ArtemisInfo } from "@/components/Globe";
import type { ArtemisViewMode } from "@/types";

interface ArtemisPanelProps {
  artemisInfo: ArtemisInfo | null;
  expanded: boolean;
  onToggleExpand: () => void;
  artemisView: ArtemisViewMode;
  onViewChange: (view: ArtemisViewMode | "none") => void;
  trackArtemis: boolean;
  onTrackToggle: () => void;
}

export default function ArtemisPanel({
  artemisInfo,
  expanded,
  onToggleExpand,
  artemisView,
  onViewChange,
  trackArtemis,
  onTrackToggle,
}: ArtemisPanelProps) {
  return (
    <div className="rounded-xl border border-orange-400/20 bg-black/60 backdrop-blur-xl text-white shadow-2xl">
      <div className="flex items-center justify-between p-4">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <h3 className="text-sm font-semibold text-orange-300">Artemis II — Orion</h3>
          <span className="text-white/30 text-xs">{expanded ? "▼" : "▶"}</span>
        </button>
        <div className="flex gap-1">
          {(["earth-orbit", "lunar-transit", "flyby-return"] as const).map((view) => {
            const labels = { "earth-orbit": "Earth", "lunar-transit": "Transit", "flyby-return": "Flyby" } as const;
            const isActive = artemisView === view;
            return (
              <button
                key={view}
                onClick={() => onViewChange(isActive ? "none" : view)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                  isActive
                    ? "border-orange-400/40 text-orange-300 bg-orange-400/10"
                    : "border-white/10 text-white/30 hover:text-white/50"
                }`}
              >
                {labels[view]}
              </button>
            );
          })}
        </div>
      </div>
      {expanded && (
        <div className="px-4 pb-4">
          <ArtemisContent
            info={artemisInfo}
            isTracking={trackArtemis}
            onTrackToggle={onTrackToggle}
          />
        </div>
      )}
    </div>
  );
}
