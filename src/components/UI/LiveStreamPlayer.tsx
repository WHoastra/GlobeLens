"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Volume2, VolumeX } from "lucide-react";

const LIVE_CHANNELS = [
  { key: "bloomberg", label: "Bloomberg", channel: "UCIALMKvObZNtJ68-rmLjXhA" },
  { key: "sky", label: "Sky News", channel: "UCoMdktPbSTixAyNGwb-UYkQ" },
  { key: "france24", label: "France 24", channel: "UCQfwfsi5VrQ8yKZ-UWmAEFg" },
  { key: "aljazeera", label: "Al Jazeera", channel: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
  { key: "abc", label: "ABC News", channel: "UCBi2mrWuNuyYy4gbM6fU18Q" },
] as const;

export default function LiveStreamPlayer() {
  const [activeChannel, setActiveChannel] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(true);

  const handleChannelClick = useCallback((channelKey: string) => {
    if (activeChannel === channelKey) {
      setActiveChannel(null);
    } else {
      setActiveChannel(channelKey);
      setExpanded(true);
    }
  }, [activeChannel]);

  return (
    <div className="border-t border-white/10 shrink-0">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center justify-between w-full px-4 py-2"
      >
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/70">Live Streams</span>
        </div>
        {expanded ? <ChevronDown size={14} className="text-white/40" /> : <ChevronUp size={14} className="text-white/40" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex gap-1 overflow-x-auto">
            {LIVE_CHANNELS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => handleChannelClick(key)}
                className={`px-2.5 py-1 rounded text-[10px] font-medium shrink-0 transition-all border ${
                  activeChannel === key
                    ? "bg-red-500/20 border-red-400/40 text-red-300"
                    : "bg-white/5 border-white/10 text-white/40 hover:text-white/60 hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeChannel && (
            <div className="relative rounded-lg overflow-hidden bg-black border border-white/10">
              <iframe
                key={activeChannel + (muted ? "-muted" : "-unmuted")}
                src={`https://www.youtube.com/embed/live_stream?channel=${LIVE_CHANNELS.find((c) => c.key === activeChannel)!.channel}&autoplay=1&mute=${muted ? 1 : 0}`}
                className="w-full"
                style={{ height: 170 }}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title={`${LIVE_CHANNELS.find((c) => c.key === activeChannel)!.label} Live`}
              />
              <button
                onClick={() => setMuted((m) => !m)}
                className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/60 border border-white/20 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          )}

          {!activeChannel && (
            <p className="text-[10px] text-white/30 text-center py-3">Select a channel to watch live</p>
          )}
        </div>
      )}
    </div>
  );
}
