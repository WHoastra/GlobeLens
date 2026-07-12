"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  ChevronDown,
  ChevronUp,
  Activity,
  Wind,
  Droplet,
  Leaf,
  Zap,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  Play,
  GitCompare,
  Waves,
} from "lucide-react";
import type { BuoyNetworkData } from "@/lib/bayouBuoyRenderer";

export type DemoMode = "normal" | "hurricane" | "spill" | "algal" | "chaos" | "storm-surge";

// Re-export so consumers have one canonical type
export type HUDNetworkData = BuoyNetworkData;

interface BayouBuoyHUDProps {
  data: BuoyNetworkData | null;
  mode: DemoMode;
  onModeChange: (mode: DemoMode) => void;
  onClose: () => void;
  visible: boolean;
  onStartDemo?: () => void;
  compareCount?: number;
  onOpenCompare?: () => void;
}

const MODES: { key: DemoMode; label: string; icon: typeof Activity; color: string }[] = [
  { key: "normal", label: "Normal Ops", icon: Activity, color: "#22D3EE" },
  { key: "hurricane", label: "Hurricane", icon: Wind, color: "#FFAA00" },
  { key: "storm-surge", label: "Storm Surge", icon: Waves, color: "#FF6B6B" },
  { key: "spill", label: "Spill", icon: Droplet, color: "#FF3300" },
  { key: "algal", label: "Algal Bloom", icon: Leaf, color: "#00FF88" },
  { key: "chaos", label: "Chaos", icon: Zap, color: "#FF00AA" },
];

function formatLarge(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface FeedEvent {
  key: string;
  buoyId: string;
  label: string;
  color: string;
  minutesAgo: number;
}

function buildEvents(data: BuoyNetworkData): FeedEvent[] {
  const events: FeedEvent[] = [];
  for (const b of data.buoys) {
    if (b.oilAlert) {
      events.push({
        key: `oil-${b.id}`,
        buoyId: b.id,
        label: "Oil signature detected",
        color: "#FF3300",
        minutesAgo: 1 + (hashId(b.id) % 28),
      });
    }
    if (b.algalAlert) {
      events.push({
        key: `algal-${b.id}`,
        buoyId: b.id,
        label: "Algal bloom rising",
        color: "#00FF88",
        minutesAgo: 1 + (hashId(b.id + "a") % 28),
      });
    }
    if (!b.online) {
      events.push({
        key: `off-${b.id}`,
        buoyId: b.id,
        label: "Telemetry loss",
        color: "#888888",
        minutesAgo: 1 + (hashId(b.id + "o") % 28),
      });
    }
  }
  if (data.alerts.hurricane) {
    events.unshift({
      key: "hurricane-network",
      buoyId: "NETWORK",
      label: "Tropical system tracked",
      color: "#FFAA00",
      minutesAgo: 3,
    });
  }
  events.sort((a, b) => a.minutesAgo - b.minutesAgo);
  return events.slice(0, 5);
}

function BayouBuoyHUD({ data, mode, onModeChange, onClose, visible, onStartDemo, compareCount = 0, onOpenCompare }: BayouBuoyHUDProps) {
  const [expanded, setExpanded] = useState(true);
  const lastDepthRef = useRef<number | null>(null);
  const [tideTrend, setTideTrend] = useState<{ dir: "rising" | "falling"; deltaFt: number } | null>(null);

  const onlineCount = data?.buoys.filter((b) => b.online).length ?? 0;
  const totalCount = data?.buoyCount ?? 0;
  const dataPointsPerDay = totalCount * 17 * 144;
  const totalAlerts = (data?.alerts.oil ?? 0) + (data?.alerts.algal ?? 0) + (data?.alerts.offline ?? 0)
    + (data?.alerts.hurricane ? 1 : 0);

  const avgSalinity = data ? avg(data.buoys.map((b) => b.salinityPpt)) : 0;
  const avgWaterTemp = data ? avg(data.buoys.map((b) => b.waterTempC)) : 0;
  const avgDO = data ? avg(data.buoys.map((b) => b.dissolvedOxygenMgL)) : 0;
  const avgWind = data ? avg(data.buoys.map((b) => b.windSpeedKts)) : 0;
  const avgBaro = data ? avg(data.buoys.map((b) => b.barometricMb)) : 0;
  const avgDepth = data ? avg(data.buoys.map((b) => b.depthM)) : 0;

  // Track avg depth across polls to compute tide trend
  useEffect(() => {
    if (!data) return;
    const prev = lastDepthRef.current;
    if (prev !== null && Math.abs(avgDepth - prev) > 0.005) {
      const deltaM = avgDepth - prev;
      const deltaFt = deltaM * 3.28084;
      setTideTrend({
        dir: deltaM > 0 ? "rising" : "falling",
        deltaFt: Math.abs(deltaFt),
      });
    }
    lastDepthRef.current = avgDepth;
  }, [data, avgDepth]);

  const events = data ? buildEvents(data) : [];

  if (!visible) return null;

  return (
    <div className="fixed top-20 left-4 z-20 w-[calc(100vw-2rem)] md:w-80 rounded-xl bg-black/85 backdrop-blur-xl border border-white/10 text-white shadow-2xl flex flex-col overflow-hidden">
      {/* Brand strip — tappable on mobile to collapse */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 hover:bg-white/5 transition-colors md:cursor-default md:hover:bg-transparent"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[11px] font-bold shrink-0">
            B
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-bold tracking-tight truncate">BayouBuoy</p>
            <p className="text-[9px] uppercase tracking-wider text-white/50 truncate">
              Coastal LA Intelligence
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {compareCount > 0 && onOpenCompare && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onOpenCompare(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onOpenCompare(); } }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-400/15 border border-purple-400/40 text-purple-200 hover:bg-purple-400/25 transition-colors cursor-pointer"
            >
              <GitCompare size={10} />
              Compare {compareCount}
            </span>
          )}
          {onStartDemo && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onStartDemo(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onStartDemo(); } }}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-cyan-400/15 border border-cyan-400/40 text-cyan-200 hover:bg-cyan-400/25 transition-colors cursor-pointer"
            >
              <Play size={10} className="fill-cyan-200" />
              Start Demo
            </span>
          )}
          <span className="md:hidden">
            {expanded ? <ChevronUp size={14} className="text-white/50" /> : <ChevronDown size={14} className="text-white/50" />}
          </span>
        </div>
      </button>

      {/* Body */}
      <div className={`${expanded ? "flex" : "hidden"} md:flex flex-col`}>
        {/* Big metrics row */}
        <div className="grid grid-cols-3 gap-2 p-3 border-b border-white/5">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Online</p>
            <p className="text-lg font-bold font-mono leading-tight">
              {onlineCount.toLocaleString()}
              <span className="text-white/40 text-xs">/{totalCount.toLocaleString()}</span>
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Data / Day</p>
            <p className="text-lg font-bold font-mono leading-tight text-cyan-300">
              {formatLarge(dataPointsPerDay)}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Alerts</p>
            <div className="flex items-center gap-1.5">
              {totalAlerts > 0 && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
              <p className={`text-lg font-bold font-mono leading-tight ${totalAlerts > 0 ? "text-red-300" : ""}`}>
                {totalAlerts}
              </p>
            </div>
          </div>
        </div>

        {/* Live conditions — averages */}
        <div className="grid grid-cols-3 gap-x-2 gap-y-2 p-3 border-b border-white/5 text-[11px]">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Salinity</p>
            <p className="font-mono font-semibold">{avgSalinity.toFixed(1)} <span className="text-white/40">ppt</span></p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Water</p>
            <p className="font-mono font-semibold">{avgWaterTemp.toFixed(1)} <span className="text-white/40">°C</span></p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">DO</p>
            <p className="font-mono font-semibold">{avgDO.toFixed(1)} <span className="text-white/40">mg/L</span></p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Wind</p>
            <p className="font-mono font-semibold">{avgWind.toFixed(0)} <span className="text-white/40">kts</span></p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Tide</p>
            <p className="font-mono font-semibold flex items-center gap-0.5">
              {tideTrend ? (
                <>
                  {tideTrend.dir === "rising"
                    ? <ArrowUp size={10} className="text-green-300" />
                    : <ArrowDown size={10} className="text-orange-300" />}
                  {tideTrend.deltaFt.toFixed(2)}<span className="text-white/40"> ft</span>
                </>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-white/40">Baro</p>
            <p className="font-mono font-semibold">{avgBaro.toFixed(0)} <span className="text-white/40">mb</span></p>
          </div>
        </div>

        {/* Demo mode selector */}
        <div className="p-3 border-b border-white/5">
          <p className="text-[9px] uppercase tracking-wider text-white/40 mb-2">Demo Mode</p>
          <div className="flex gap-1.5 overflow-x-auto md:flex-wrap md:overflow-visible -mx-1 px-1 pb-1">
            {MODES.map(({ key, label, icon: Icon, color }) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  onClick={() => onModeChange(key)}
                  className={`flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border text-xs font-semibold shrink-0 transition-all ${
                    active
                      ? "border-white/40 bg-white/15 text-white shadow-lg"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80"
                  }`}
                  style={active ? { boxShadow: `0 0 0 1px ${color}55, 0 4px 12px ${color}33` } : undefined}
                >
                  <Icon size={13} style={{ color: active ? color : undefined }} />
                  <span className="whitespace-nowrap">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent events feed */}
        <div className="p-3 border-b border-white/5">
          <p className="text-[9px] uppercase tracking-wider text-white/40 mb-2">Recent Events</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {events.length === 0 ? (
              <div className="flex items-center gap-2 text-[11px] text-white/40 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                Network nominal
              </div>
            ) : (
              events.map((e) => (
                <div key={e.key} className="flex items-center gap-2 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: e.color }} />
                  <span className="text-white/80 truncate flex-1">{e.label}</span>
                  <span className="font-mono text-white/50 shrink-0">{e.buoyId}</span>
                  <span className="text-white/30 shrink-0">{e.minutesAgo}m</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Hide layer */}
        <div className="flex justify-end p-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
          >
            <X size={12} />
            Hide Layer
          </button>
        </div>

        {/* No-data warning */}
        {!data && (
          <div className="px-3 pb-3">
            <div className="flex items-center gap-2 text-[10px] text-yellow-300/70 bg-yellow-500/5 border border-yellow-500/20 rounded-md px-2 py-1.5">
              <AlertCircle size={11} />
              Awaiting telemetry…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(BayouBuoyHUD, (prev, next) => {
  return prev.mode === next.mode
    && prev.visible === next.visible
    && prev.data?.timestamp === next.data?.timestamp
    && prev.onStartDemo === next.onStartDemo
    && prev.compareCount === next.compareCount
    && prev.onOpenCompare === next.onOpenCompare;
});
