"use client";

import { useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Volume2, VolumeX, Play, X } from "lucide-react";

const LIVE_CHANNELS = [
  { key: "france24", label: "France 24", channel: "UCQfwfsi5VrQ8yKZ-UWmAEFg" },
  { key: "aljazeera", label: "Al Jazeera", channel: "UCNye-wNBqNL5ZzHSJj3l8Bg" },
  { key: "dw", label: "DW News", channel: "UCknLrEdhRCp1aegoMqRaCZg" },
  { key: "euronews", label: "Euronews", channel: "UCW2QcKZiU8aUGg4yxCIditg" },
  { key: "cna", label: "CNA", channel: "UCo8bcnLyZH8tBIH9V1mLgqQ" },
  { key: "sky", label: "Sky News", channel: "UCoMdktPbSTixAyNGwb-UYkQ" },
  { key: "fox", label: "Fox LiveNOW", channel: "UCyEUZXhmHr2rXGVHqX4gt7g" },
  { key: "bloomberg", label: "Bloomberg", channel: "UCIALMKvObZNtJ6AmdCLP7Lg" },
] as const;

export default function LiveStreamPlayer() {
  const [activeChannel, setActiveChannel] = useState<string>("france24");
  const [expanded, setExpanded] = useState(true);
  const [muted, setMuted] = useState(true);
  // Click-to-play: the YouTube iframe is only mounted after the user hits
  // play, so an autoplaying stream never competes with the user's own
  // YouTube playback in another tab.
  const [playing, setPlaying] = useState(false);

  const handleChannelClick = useCallback((channelKey: string) => {
    setActiveChannel(channelKey);
    setExpanded(true);
  }, []);

  const active = LIVE_CHANNELS.find((c) => c.key === activeChannel)!;

  return (
    <div className="border-t border-white/10 shrink-0">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center justify-between w-full px-4 py-2"
      >
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full bg-red-500 ${playing ? "animate-pulse" : ""}`} />
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

          <div className="relative rounded-lg overflow-hidden bg-black border border-white/10">
            {playing ? (
              <>
                <iframe
                  key={activeChannel + (muted ? "-muted" : "-unmuted")}
                  src={`https://www.youtube.com/embed/live_stream?channel=${active.channel}&autoplay=1&mute=${muted ? 1 : 0}`}
                  className="w-full"
                  style={{ height: 200 }}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={`${active.label} Live`}
                />
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="absolute bottom-2 right-2 p-1.5 rounded-md bg-black/60 border border-white/20 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <button
                  onClick={() => setPlaying(false)}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 border border-white/20 text-white/70 hover:text-white hover:bg-black/80 transition-colors"
                  title="Stop stream"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <button
                onClick={() => setPlaying(true)}
                className="w-full flex flex-col items-center justify-center gap-2 group"
                style={{ height: 200 }}
                title={`Play ${active.label} live stream`}
              >
                <span className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500/20 border border-red-400/40 text-red-300 group-hover:bg-red-500/30 transition-colors">
                  <Play size={20} className="ml-0.5" />
                </span>
                <span className="text-[11px] text-white/50">
                  Play {active.label} live
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
