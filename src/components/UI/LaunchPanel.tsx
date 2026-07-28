"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Rocket } from "lucide-react";
import type { Launch, LaunchProvider } from "@/types";
import { LAUNCH_PROVIDERS } from "@/types";

const STATUS_COLORS: Record<string, string> = {
  Go: "#4ade80",
  TBC: "#facc15",
  TBD: "#9ca3af",
  Hold: "#facc15",
  "In Flight": "#38bdf8",
  Success: "#4ade80",
  Failure: "#f87171",
  "Partial Failure": "#fb923c",
};

function formatCountdown(net: string, now: number): string {
  const diff = new Date(net).getTime() - now;
  if (diff <= 0) return "T-0";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (d > 0) return `T-${d}d ${h}h ${m}m`;
  if (h > 0) return `T-${h}h ${m}m ${s}s`;
  return `T-${m}m ${s}s`;
}

function formatNet(net: string): string {
  const d = new Date(net);
  return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Self-ticking countdown — keeps the 1s re-render local instead of
 *  re-rendering the whole launch list every second. */
function Countdown({ net }: { net: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const isImminent = new Date(net).getTime() - now < 24 * 3_600_000;
  return (
    <span className={`text-xs font-mono font-bold ${isImminent ? "text-green-400" : "text-white/70"}`}>
      {formatCountdown(net, now)}
    </span>
  );
}

interface LaunchPanelProps {
  launches: Launch[];
  activeProvider: LaunchProvider | "all";
  onProviderChange: (p: LaunchProvider | "all") => void;
  onLaunchClick: (launch: Launch) => void;
  onClose: () => void;
  selectedLaunchId: string | null;
  inline?: boolean;
}

export default function LaunchPanel({
  launches,
  activeProvider,
  onProviderChange,
  onLaunchClick,
  onClose,
  selectedLaunchId,
  inline = false,
}: LaunchPanelProps) {
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Scroll to the selected launch when picked from the globe
  useEffect(() => {
    if (selectedLaunchId) {
      cardRefs.current.get(selectedLaunchId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedLaunchId]);

  const filtered = activeProvider === "all"
    ? launches
    : launches.filter((l) => l.provider === activeProvider);

  const upcoming = filtered
    .filter((l) => l.upcoming)
    .sort((a, b) => new Date(a.net).getTime() - new Date(b.net).getTime());
  const recent = filtered
    .filter((l) => !l.upcoming)
    .sort((a, b) => new Date(b.net).getTime() - new Date(a.net).getTime());

  const tabs: { key: LaunchProvider | "all"; label: string; color: string }[] = [
    { key: "all", label: "All", color: "#AAAAAA" },
    ...LAUNCH_PROVIDERS,
  ];

  const renderCard = (launch: Launch) => {
    const provider = LAUNCH_PROVIDERS.find((p) => p.key === launch.provider);
    const statusColor = STATUS_COLORS[launch.statusAbbrev] ?? "#9ca3af";
    const isSelected = launch.id === selectedLaunchId;

    return (
      <div
        key={launch.id}
        ref={(el) => { if (el) cardRefs.current.set(launch.id, el); }}
        onClick={() => onLaunchClick(launch)}
        className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
          isSelected ? "bg-white/10" : "hover:bg-white/5"
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: provider?.color }} />
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: provider?.color }}>
            {launch.providerName}
          </span>
          <span
            className="ml-auto px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border"
            style={{ color: statusColor, borderColor: `${statusColor}66` }}
          >
            {launch.statusAbbrev}
          </span>
        </div>
        <h3 className="text-sm font-semibold text-white leading-snug">{launch.name}</h3>
        <div className="flex items-center gap-2 mt-1 text-[11px] text-white/40">
          <span className="truncate">{launch.padLocation || launch.padName}</span>
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          {launch.upcoming ? (
            <Countdown net={launch.net} />
          ) : (
            <span className="text-xs font-mono text-white/50">{formatNet(launch.net)}</span>
          )}
          {launch.upcoming && (
            <span className="text-[10px] text-white/30">{formatNet(launch.net)}</span>
          )}
          {launch.orbitAbbrev && (
            <span className="ml-auto px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] text-white/50">
              {launch.orbitAbbrev}
            </span>
          )}
        </div>

        {/* Expanded details for the selected launch */}
        {isSelected && (
          <div className="mt-2 space-y-2">
            {launch.image && (
              <img
                src={launch.image}
                alt=""
                className="w-full max-h-36 object-cover rounded-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            {launch.missionDescription && (
              <p className="text-[11px] text-white/50 leading-relaxed line-clamp-5">
                {launch.missionDescription}
              </p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-white/40">
              <span>Pad: {launch.padName}</span>
              {launch.orbitName && <span>Orbit: {launch.orbitName}</span>}
            </div>
            {launch.webcastUrl && (
              <a
                href={launch.webcastUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink size={11} />
                {launch.webcastLive ? "Watch live webcast" : "Watch webcast"}
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  const content = (
    <>
      {/* Provider tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5 shrink-0">
        {tabs.map(({ key, label, color }) => {
          const isActive = activeProvider === key;
          return (
            <button
              key={key}
              onClick={() => onProviderChange(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all border ${
                isActive
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, opacity: isActive ? 1 : 0.4 }} />
              {label}
            </button>
          );
        })}
      </div>

      {/* Launch list */}
      <div className="flex-1 overflow-y-auto">
        {upcoming.length === 0 && recent.length === 0 ? (
          <p className="text-center text-sm text-white/30 py-8">No launches found</p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[9px] text-white/30 uppercase tracking-wider">
                  Upcoming ({upcoming.length})
                </p>
                {upcoming.map(renderCard)}
              </>
            )}
            {recent.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-[9px] text-white/30 uppercase tracking-wider">
                  Recent ({recent.length})
                </p>
                {recent.map(renderCard)}
              </>
            )}
          </>
        )}
      </div>
    </>
  );

  if (inline) {
    return (
      <div className="flex flex-col max-h-[50vh]">
        <div className="flex items-center gap-2 pb-2">
          <Rocket size={14} className="text-white/60" />
          <h2 className="text-sm font-bold tracking-wide uppercase text-white">Launches</h2>
        </div>
        {content}
      </div>
    );
  }

  return (
    <div className="side-panel-animate fixed top-0 right-0 h-screen w-[400px] bg-black/85 backdrop-blur-xl border-l border-white/10 text-white z-20 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <h2 className="text-sm font-bold tracking-wide uppercase">Launches</h2>
          <span className="text-xs text-white/40">{launches.filter((l) => l.upcoming).length} upcoming</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X size={16} className="text-white/50" />
        </button>
      </div>
      {content}
    </div>
  );
}
