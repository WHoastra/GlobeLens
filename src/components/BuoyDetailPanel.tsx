"use client";

import { useEffect, useMemo } from "react";
import { X, Battery, Signal, Sun, ArrowUp, ArrowDown, FileText, MapPin, TrendingUp, Plus, Check } from "lucide-react";
import { useState } from "react";
import type { BuoyData, SensorKey } from "@/lib/bayouBuoyRenderer";
import { generateReading } from "@/lib/bayouBuoySimulator";

export type { BuoyData, SensorKey };

export interface BuoyReading extends BuoyData {
  timestamp: number;
}

interface BuoyDetailPanelProps {
  buoy: BuoyData | null;
  onClose: () => void;
  timeSeries?: BuoyReading[];
  // Compare integration
  isInCompare?: boolean;
  compareCount?: number;
  compareMax?: number;
  onToggleCompare?: (buoy: BuoyData) => void;
  // Sensor selection (lifted) — drives both the modal and the on-globe gradient
  selectedSensor?: SensorKey | null;
  onSensorSelect?: (sensor: SensorKey | null) => void;
}

export const SENSOR_META: Record<SensorKey, { label: string; unit: string; color: string }> = {
  airTempC: { label: "Air Temperature", unit: "°C", color: "#FB923C" },
  humidity: { label: "Humidity", unit: "%", color: "#60A5FA" },
  barometricMb: { label: "Barometric Pressure", unit: "mb", color: "#94A3B8" },
  windSpeedKts: { label: "Wind Speed", unit: "kts", color: "#5EEAD4" },
  rainfallMmHr: { label: "Rainfall", unit: "mm/hr", color: "#38BDF8" },
  waterTempC: { label: "Water Temperature", unit: "°C", color: "#22D3EE" },
  pressureMbar: { label: "Hydrostatic Pressure", unit: "mbar", color: "#818CF8" },
  depthM: { label: "Depth (Tide)", unit: "m", color: "#A78BFA" },
  salinityPpt: { label: "Salinity", unit: "ppt", color: "#60A5FA" },
  conductivityMs: { label: "Conductivity", unit: "mS/cm", color: "#A3E635" },
  dissolvedOxygenMgL: { label: "Dissolved Oxygen", unit: "mg/L", color: "#34D399" },
  turbidityNtu: { label: "Turbidity", unit: "NTU", color: "#D4A373" },
  pH: { label: "pH", unit: "", color: "#F472B6" },
  orpMv: { label: "ORP", unit: "mV", color: "#C084FC" },
  oilFluorescencePpb: { label: "Oil Fluorescence", unit: "ppb", color: "#FF6B6B" },
  chlorophyllUgL: { label: "Chlorophyll", unit: "µg/L", color: "#4ADE80" },
  currentSpeedMs: { label: "Current Speed", unit: "m/s", color: "#2DD4BF" },
  waveHeightFt: { label: "Wave Height", unit: "ft", color: "#94A3B8" },
  wavePeriodS: { label: "Wave Period", unit: "s", color: "#94A3B8" },
};

const DAY_MS = 86_400_000;

function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

function mToFt(m: number): number {
  return m * 3.28084;
}

function statusPill(b: BuoyData): { label: string; cls: string } {
  if (!b.online) return { label: "OFFLINE", cls: "bg-gray-500/20 text-gray-300 border-gray-400/40" };
  if (b.oilAlert) return { label: "OIL ALERT", cls: "bg-red-500/20 text-red-300 border-red-400/40" };
  if (b.hurricaneMode) return { label: "HURRICANE", cls: "bg-orange-500/20 text-orange-300 border-orange-400/40" };
  if (b.algalAlert) return { label: "ALGAL BLOOM", cls: "bg-yellow-500/20 text-yellow-300 border-yellow-400/40" };
  return { label: "ONLINE", cls: "bg-green-500/20 text-green-300 border-green-400/40" };
}

function doBadge(do_: number): { label: string; cls: string } {
  if (do_ < 4) return { label: "Critical", cls: "text-red-300 bg-red-500/15 border-red-400/30" };
  if (do_ < 6) return { label: "Low", cls: "text-yellow-300 bg-yellow-500/15 border-yellow-400/30" };
  return { label: "Healthy", cls: "text-green-300 bg-green-500/15 border-green-400/30" };
}

function signalLabel(dbm: number): string {
  if (dbm > -70) return "Excellent";
  if (dbm > -85) return "Good";
  if (dbm > -100) return "Fair";
  return "Poor";
}

function batteryColor(pct: number): string {
  if (pct < 20) return "bg-red-400";
  if (pct < 50) return "bg-yellow-400";
  return "bg-green-400";
}

interface ChartProps {
  values: number[];
  color: string;
  label: string;
  unit: string;
  showAvg?: boolean;
  height?: number;
}

function MiniLineChart({ values, color, label, unit, showAvg, height = 50 }: ChartProps) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const w = 380;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const avgY = height - ((avg - min) / range) * (height - 4) - 2;
  const last = values[values.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] font-mono text-white/70">
          {last.toFixed(1)}
          <span className="text-white/40 ml-0.5">{unit}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        {showAvg && (
          <line
            x1={0}
            y1={avgY}
            x2={w}
            y2={avgY}
            stroke="white"
            strokeOpacity="0.3"
            strokeWidth="0.5"
            strokeDasharray="3 3"
          />
        )}
        <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

interface DualChartProps {
  series1: number[];
  series2: number[];
  color1: string;
  color2: string;
  label1: string;
  label2: string;
  unit1: string;
  unit2: string;
  height?: number;
}

function MiniDualLineChart({
  series1, series2, color1, color2, label1, label2, unit1, unit2, height = 50,
}: DualChartProps) {
  if (series1.length < 2 || series2.length < 2) return null;
  const w = 380;
  const norm = (vals: number[], i: number) => {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const x = (i / (vals.length - 1)) * w;
    const y = height - ((vals[i] - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const pts1 = series1.map((_, i) => norm(series1, i)).join(" ");
  const pts2 = series2.map((_, i) => norm(series2, i)).join(" ");

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label1} / {label2}</span>
        <span className="text-[10px] font-mono">
          <span style={{ color: color1 }}>{series1[series1.length - 1].toFixed(1)}{unit1}</span>
          <span className="text-white/30 mx-1">·</span>
          <span style={{ color: color2 }}>{series2[series2.length - 1].toFixed(2)}{unit2}</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
        <polyline fill="none" stroke={color1} strokeWidth="1.5" points={pts1} vectorEffect="non-scaling-stroke" />
        <polyline fill="none" stroke={color2} strokeWidth="1.5" points={pts2} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
}

interface ChipProps {
  name: string;
  value: string;
  unit: string;
  border?: "red" | "orange" | "none";
  onClick?: () => void;
}

function Chip({ name, value, unit, border = "none", onClick }: ChipProps) {
  const borderCls =
    border === "red" ? "border-red-400/50 bg-red-500/10" :
    border === "orange" ? "border-orange-400/50 bg-orange-500/10" :
    "border-white/10 bg-white/5";
  const interactiveCls = onClick ? "hover:bg-white/15 hover:border-white/30 cursor-pointer transition-colors group" : "";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`shrink-0 min-w-[100px] rounded-lg border px-3 py-2 text-left ${borderCls} ${interactiveCls}`}
    >
      <p className="text-[9px] uppercase tracking-wider text-white/40 truncate flex items-center gap-1">
        {name}
        {onClick && <TrendingUp size={9} className="text-white/30 group-hover:text-cyan-300 ml-auto shrink-0" />}
      </p>
      <p className="text-base font-bold font-mono text-white leading-tight">{value}</p>
      <p className="text-[9px] text-white/40">{unit}</p>
    </button>
  );
}

interface SensorChartModalProps {
  sensor: SensorKey;
  series: BuoyReading[];
  tempUnit: "F" | "C";
  onClose: () => void;
}

function SensorChartModal({ sensor, series, tempUnit, onClose }: SensorChartModalProps) {
  const meta = SENSOR_META[sensor];
  const isTemp = sensor === "airTempC" || sensor === "waterTempC";
  const transform = (v: number) => (isTemp && tempUnit === "F" ? cToF(v) : v);
  const displayUnit = isTemp ? `°${tempUnit}` : meta.unit;

  const rawValues = series.map((r) => r[sensor] as number);
  const values = rawValues.map(transform);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const latest = values[values.length - 1];
  const earliest = values[0];
  const trend = latest - earliest;

  // SVG geometry
  const w = 600;
  const h = 220;
  const pad = { l: 50, r: 16, t: 14, b: 28 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const range = max - min || Math.max(0.1, Math.abs(max) * 0.1);
  const xOf = (i: number) => pad.l + (i / (values.length - 1)) * cw;
  const yOf = (v: number) => pad.t + ch - ((v - min) / range) * ch;
  const points = values.map((v, i) => `${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
  const avgY = yOf(avg);
  const lastX = xOf(values.length - 1);
  const lastY = yOf(latest);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-black/95 border border-white/15 text-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-3 border-b border-white/10 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.label}
            </h3>
            <p className="text-xs text-white/50 mt-0.5">24-hour history · 1-hour resolution</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white/60" />
          </button>
        </header>

        {/* Chart */}
        <div className="p-5">
          <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ aspectRatio: `${w}/${h}` }}>
            {/* Y-axis bookends */}
            <text x={pad.l - 6} y={pad.t + 4} textAnchor="end" fontSize="10" className="fill-white/50 font-mono">
              {max.toFixed(2)}
            </text>
            <text x={pad.l - 6} y={pad.t + ch + 4} textAnchor="end" fontSize="10" className="fill-white/50 font-mono">
              {min.toFixed(2)}
            </text>
            <text x={pad.l - 6} y={avgY + 3} textAnchor="end" fontSize="9" className="fill-white/30 font-mono">
              avg
            </text>

            {/* X-axis labels */}
            <text x={pad.l} y={h - 8} fontSize="10" className="fill-white/50">24h ago</text>
            <text x={pad.l + cw / 2} y={h - 8} textAnchor="middle" fontSize="10" className="fill-white/50">12h ago</text>
            <text x={pad.l + cw} y={h - 8} textAnchor="end" fontSize="10" className="fill-white/50">now</text>

            {/* Frame */}
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ch} stroke="white" strokeOpacity="0.15" />
            <line x1={pad.l} y1={pad.t + ch} x2={pad.l + cw} y2={pad.t + ch} stroke="white" strokeOpacity="0.15" />

            {/* Average dashed line */}
            <line
              x1={pad.l} y1={avgY} x2={pad.l + cw} y2={avgY}
              stroke="white" strokeOpacity="0.3" strokeWidth="0.5" strokeDasharray="4 3"
            />

            {/* Series area + line */}
            <polyline
              fill="none"
              stroke={meta.color}
              strokeWidth="2"
              strokeLinejoin="round"
              points={points}
              vectorEffect="non-scaling-stroke"
            />

            {/* Latest value dot */}
            <circle cx={lastX} cy={lastY} r="4" fill={meta.color} />
            <circle cx={lastX} cy={lastY} r="8" fill={meta.color} fillOpacity="0.25" />
          </svg>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/40">Latest</p>
              <p className="text-base font-bold font-mono" style={{ color: meta.color }}>
                {latest.toFixed(2)}<span className="text-white/40 text-xs ml-0.5">{displayUnit}</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/40">Min</p>
              <p className="text-base font-bold font-mono text-white/70">
                {min.toFixed(2)}<span className="text-white/40 text-xs ml-0.5">{displayUnit}</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/40">Max</p>
              <p className="text-base font-bold font-mono text-white/70">
                {max.toFixed(2)}<span className="text-white/40 text-xs ml-0.5">{displayUnit}</span>
              </p>
            </div>
            <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <p className="text-[9px] uppercase tracking-wider text-white/40">24h Δ</p>
              <p className={`text-base font-bold font-mono ${trend >= 0 ? "text-green-300" : "text-red-300"}`}>
                {trend >= 0 ? "+" : ""}{trend.toFixed(2)}<span className="text-white/40 text-xs ml-0.5">{displayUnit}</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BuoyDetailPanel({
  buoy,
  onClose,
  timeSeries,
  isInCompare = false,
  compareCount = 0,
  compareMax = 4,
  onToggleCompare,
  selectedSensor = null,
  onSensorSelect,
}: BuoyDetailPanelProps) {
  const [tempUnit, setTempUnit] = useState<"F" | "C">("F");
  const [shownBuoy, setShownBuoy] = useState<BuoyData | null>(buoy);

  // Keep last buoy data for slide-out animation
  useEffect(() => {
    if (buoy) setShownBuoy(buoy);
  }, [buoy]);

  const setSelectedSensor = (s: SensorKey | null) => onSensorSelect?.(s);

  // Auto-generate 24h history for the current buoy if no external timeSeries was provided
  const effectiveSeries = useMemo<BuoyReading[]>(() => {
    if (timeSeries && timeSeries.length > 0) return timeSeries;
    if (!shownBuoy) return [];
    const conditions = {
      hurricaneActive: shownBuoy.hurricaneMode,
      spillBuoyIds: shownBuoy.oilAlert ? [shownBuoy.id] : [],
      algalBuoyIds: shownBuoy.algalAlert ? [shownBuoy.id] : [],
    };
    const now = Date.now();
    const series: BuoyReading[] = [];
    for (let h = 23; h >= 0; h--) {
      const t = now - h * 3_600_000;
      const r = generateReading(shownBuoy, t, conditions);
      series.push({ ...shownBuoy, ...r, timestamp: t });
    }
    return series;
  }, [shownBuoy, timeSeries]);

  if (!shownBuoy) return null;

  const visible = buoy !== null;
  const b = shownBuoy;
  const status = statusPill(b);
  const doBdg = doBadge(b.dissolvedOxygenMgL);

  const daysInService = Math.max(
    0,
    Math.floor((Date.now() - new Date(b.deployedDate).getTime()) / DAY_MS),
  );

  // 24h salinity avg + delta — use effectiveSeries (auto-generated if no prop)
  const salinity24hAvg = effectiveSeries.length > 0
    ? effectiveSeries.reduce((a, r) => a + r.salinityPpt, 0) / effectiveSeries.length
    : null;
  const salinityDelta = salinity24hAvg !== null ? b.salinityPpt - salinity24hAvg : null;

  // Tide direction
  const tideDir: "rising" | "falling" | null = (() => {
    if (effectiveSeries.length < 2) return null;
    const d = b.depthM - effectiveSeries[effectiveSeries.length - 1].depthM;
    if (Math.abs(d) < 0.01) return null;
    return d > 0 ? "rising" : "falling";
  })();

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 768px)").matches) return; // desktop: skip swipe
    const el = e.currentTarget;
    const startY = e.touches[0].clientY;
    const onMove = (ev: TouchEvent) => {
      const dy = ev.touches[0].clientY - startY;
      if (dy > 0) el.style.transform = `translateY(${dy}px)`;
    };
    const onEnd = (ev: TouchEvent) => {
      const dy = ev.changedTouches[0].clientY - startY;
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      if (dy > 100) {
        el.style.transform = "";
        onClose();
      } else {
        el.style.transform = "";
      }
    };
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
  };

  const tempDisplay = (c: number) =>
    `${(tempUnit === "F" ? cToF(c) : c).toFixed(1)}°${tempUnit}`;

  return (
    <div
      onTouchStart={handleTouchStart}
      className={`fixed z-30 bg-black/85 backdrop-blur-xl border border-white/10 text-white shadow-2xl flex flex-col transition-transform duration-200
        bottom-0 left-0 right-0 max-h-[92vh] rounded-t-2xl
        md:bottom-auto md:left-auto md:top-0 md:right-0 md:h-screen md:max-h-screen md:w-[420px] md:rounded-none md:rounded-l-2xl
        ${visible
          ? "translate-y-0 md:translate-x-0"
          : "translate-y-full md:translate-y-0 md:translate-x-full pointer-events-none"
        }`}
    >
      {/* Mobile drag handle */}
      <div className="flex justify-center pt-2 md:hidden">
        <div className="w-10 h-1 rounded-full bg-white/30" />
      </div>

      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold font-mono tracking-tight">{b.id}</h2>
          <p className="text-sm text-white/60 mt-0.5">{b.basin}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${status.cls}`}>
              {status.label}
            </span>
            <span className="text-[10px] text-white/40 font-mono flex items-center gap-1">
              <MapPin size={10} />
              {b.lat.toFixed(4)}°N, {Math.abs(b.lon).toFixed(4)}°W
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleCompare && (() => {
            const compareFull = !isInCompare && compareCount >= compareMax;
            return (
              <button
                onClick={() => onToggleCompare(b)}
                disabled={compareFull}
                title={
                  isInCompare ? "Remove from compare"
                  : compareFull ? `Compare full (${compareMax} max)`
                  : `Add to compare (${compareCount}/${compareMax})`
                }
                className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-colors ${
                  isInCompare
                    ? "bg-cyan-400/20 border-cyan-400/50 text-cyan-200 hover:bg-cyan-400/30"
                    : compareFull
                      ? "bg-white/5 border-white/10 text-white/30 cursor-not-allowed"
                      : "bg-white/5 border-white/15 text-white/70 hover:bg-white/15 hover:text-white"
                }`}
              >
                {isInCompare ? <Check size={11} /> : <Plus size={11} />}
                {isInCompare ? "Comparing" : "Compare"}
              </button>
            );
          })()}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* KPI 2x2 */}
        <div className="grid grid-cols-2 gap-2 p-4">
          {/* Salinity */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Salinity</p>
            <p className="text-2xl font-bold font-mono text-blue-300 mt-0.5">{b.salinityPpt.toFixed(1)}</p>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/40">ppt</p>
              {salinityDelta !== null && (
                <span className={`text-[10px] font-mono ${salinityDelta >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {salinityDelta >= 0 ? "+" : ""}{salinityDelta.toFixed(1)} 24h
                </span>
              )}
            </div>
          </div>

          {/* Water Temp */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
            <div className="flex items-start justify-between">
              <p className="text-[10px] uppercase tracking-wider text-white/40">Water Temp</p>
              <button
                onClick={() => setTempUnit(u => u === "F" ? "C" : "F")}
                className="text-[9px] text-white/40 hover:text-white/70 px-1.5 rounded border border-white/10"
              >
                °{tempUnit === "F" ? "C" : "F"}
              </button>
            </div>
            <p className="text-2xl font-bold font-mono text-cyan-300 mt-0.5">{tempDisplay(b.waterTempC)}</p>
            <p className="text-[10px] text-white/40">air {tempDisplay(b.airTempC)}</p>
          </div>

          {/* Dissolved O₂ */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Dissolved O₂</p>
            <p className="text-2xl font-bold font-mono text-emerald-300 mt-0.5">{b.dissolvedOxygenMgL.toFixed(1)}</p>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-white/40">mg/L</p>
              <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${doBdg.cls}`}>
                {doBdg.label}
              </span>
            </div>
          </div>

          {/* Tide / Depth */}
          <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40">Tide / Depth</p>
            <div className="flex items-baseline gap-1 mt-0.5">
              <p className="text-2xl font-bold font-mono text-purple-300">{b.depthM.toFixed(2)}</p>
              {tideDir === "rising" && <ArrowUp size={14} className="text-green-300" />}
              {tideDir === "falling" && <ArrowDown size={14} className="text-orange-300" />}
            </div>
            <p className="text-[10px] text-white/40">{b.depthM.toFixed(2)} m · {mToFt(b.depthM).toFixed(1)} ft</p>
          </div>
        </div>

        {/* All-17 sensor chips */}
        <div className="px-4 pb-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">All Sensors</p>
          <div className="flex md:grid md:grid-cols-3 gap-2 overflow-x-auto md:overflow-visible -mx-1 px-1 md:mx-0 md:px-0 pb-1">
            <Chip name="Air Temp" value={tempDisplay(b.airTempC).slice(0, -2)} unit={`°${tempUnit}`} border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("airTempC")} />
            <Chip name="Humidity" value={b.humidity.toFixed(0)} unit="%" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("humidity")} />
            <Chip name="Barometric" value={b.barometricMb.toFixed(0)} unit="mb" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("barometricMb")} />
            <Chip name="Wind" value={`${b.windSpeedKts.toFixed(0)}@${b.windDirDeg}°`} unit="kts" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("windSpeedKts")} />
            <Chip name="Rainfall" value={b.rainfallMmHr.toFixed(1)} unit="mm/hr" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("rainfallMmHr")} />
            <Chip name="Water Temp" value={tempDisplay(b.waterTempC).slice(0, -2)} unit={`°${tempUnit}`} onClick={() => setSelectedSensor("waterTempC")} />
            <Chip name="Hydro Press" value={b.pressureMbar.toFixed(0)} unit="mbar" onClick={() => setSelectedSensor("pressureMbar")} />
            <Chip name="Depth" value={b.depthM.toFixed(2)} unit="m" onClick={() => setSelectedSensor("depthM")} />
            <Chip name="Salinity" value={b.salinityPpt.toFixed(1)} unit="ppt" onClick={() => setSelectedSensor("salinityPpt")} />
            <Chip name="Conductivity" value={b.conductivityMs.toFixed(1)} unit="mS/cm" onClick={() => setSelectedSensor("conductivityMs")} />
            <Chip name="Dissolved O₂" value={b.dissolvedOxygenMgL.toFixed(1)} unit="mg/L" border={b.algalAlert ? "red" : "none"} onClick={() => setSelectedSensor("dissolvedOxygenMgL")} />
            <Chip name="Turbidity" value={b.turbidityNtu.toFixed(0)} unit="NTU" border={b.oilAlert || b.algalAlert ? "red" : b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("turbidityNtu")} />
            <Chip name="pH" value={b.pH.toFixed(2)} unit="" border={b.algalAlert ? "red" : "none"} onClick={() => setSelectedSensor("pH")} />
            <Chip name="ORP" value={b.orpMv.toFixed(0)} unit="mV" border={b.algalAlert ? "red" : "none"} onClick={() => setSelectedSensor("orpMv")} />
            <Chip name="Oil Fluor." value={b.oilFluorescencePpb.toFixed(0)} unit="ppb" border={b.oilAlert ? "red" : "none"} onClick={() => setSelectedSensor("oilFluorescencePpb")} />
            <Chip name="Chlorophyll" value={b.chlorophyllUgL.toFixed(1)} unit="µg/L" border={b.algalAlert ? "red" : "none"} onClick={() => setSelectedSensor("chlorophyllUgL")} />
            <Chip name="Current" value={`${b.currentSpeedMs.toFixed(2)}@${b.currentDirDeg}°`} unit="m/s" onClick={() => setSelectedSensor("currentSpeedMs")} />
            <Chip name="Wave Ht" value={b.waveHeightFt.toFixed(1)} unit="ft" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("waveHeightFt")} />
            <Chip name="Wave Period" value={b.wavePeriodS.toFixed(1)} unit="s" border={b.hurricaneMode ? "orange" : "none"} onClick={() => setSelectedSensor("wavePeriodS")} />
          </div>
        </div>

        {/* Time-series charts */}
        <div className="px-4 pb-4 border-t border-white/5 pt-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-3">24h History</p>
          {effectiveSeries.length >= 2 ? (
            <div className="space-y-3">
              <MiniLineChart
                label="Salinity"
                unit=" ppt"
                values={effectiveSeries.map(r => r.salinityPpt)}
                color="#60A5FA"
                showAvg
              />
              <MiniDualLineChart
                label1="Water"
                label2="Air"
                unit1="°C"
                unit2="°C"
                series1={effectiveSeries.map(r => r.waterTempC)}
                series2={effectiveSeries.map(r => r.airTempC)}
                color1="#22D3EE"
                color2="#FB923C"
              />
              <MiniDualLineChart
                label1="Tide"
                label2="Wave"
                unit1=" m"
                unit2=" ft"
                series1={effectiveSeries.map(r => r.depthM)}
                series2={effectiveSeries.map(r => r.waveHeightFt)}
                color1="#A78BFA"
                color2="#94A3B8"
              />
              <MiniDualLineChart
                label1="DO"
                label2="pH"
                unit1=" mg/L"
                unit2=""
                series1={effectiveSeries.map(r => r.dissolvedOxygenMgL)}
                series2={effectiveSeries.map(r => r.pH)}
                color1="#34D399"
                color2="#F472B6"
              />
            </div>
          ) : (
            <p className="text-xs text-white/40 italic px-3 py-4 rounded-lg bg-white/5 border border-white/10">
              Live data only — historical archive available via API.
            </p>
          )}
        </div>

        {/* Deployment metadata */}
        <div className="px-4 pb-4 border-t border-white/5 pt-4 space-y-3">
          <p className="text-[10px] uppercase tracking-wider text-white/40">Deployment</p>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-[10px] text-white/40">Deployed</p>
              <p className="font-mono text-white/80">{b.deployedDate}</p>
              <p className="text-[10px] text-white/40">{daysInService} days in service</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40">Last Service</p>
              <p className="font-mono text-white/80">42 days ago</p>
              <p className="text-[10px] text-white/40">CPRA · Tier Gov</p>
            </div>
          </div>

          {/* Battery */}
          <div>
            <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
              <span className="flex items-center gap-1.5"><Battery size={11} /> Battery</span>
              <span className="font-mono text-white/70">{b.batteryPct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${batteryColor(b.batteryPct)} transition-all`}
                style={{ width: `${Math.max(0, Math.min(100, b.batteryPct))}%` }}
              />
            </div>
          </div>

          {/* Signal + Solar */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span className="flex items-center gap-1.5"><Signal size={11} /> Signal</span>
                <span className="font-mono text-white/70">{b.signalDbm} dBm</span>
              </div>
              <p className="text-[10px] text-white/50 mt-0.5">{signalLabel(b.signalDbm)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span className="flex items-center gap-1.5"><Sun size={11} /> Solar</span>
                <span className="font-mono text-white/70">{b.solarChargeW.toFixed(1)} W</span>
              </div>
              <p className="text-[10px] text-white/50 mt-0.5">
                {b.solarChargeW > 2 ? "Charging" : b.solarChargeW > 0 ? "Trickle" : "Night"}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 flex items-center justify-between">
          <p className="text-[10px] text-white/30">
            Whoastra Labs · BayouBuoy v1.5
          </p>
          <a
            href="#"
            className="flex items-center gap-1 text-[10px] text-blue-400/70 hover:text-blue-300 transition-colors"
          >
            <FileText size={10} />
            Whitepaper
          </a>
        </div>
      </div>

      {/* Sensor chart modal — overlays panel + globe when a chip is clicked */}
      {selectedSensor && effectiveSeries.length >= 2 && (
        <SensorChartModal
          sensor={selectedSensor}
          series={effectiveSeries}
          tempUnit={tempUnit}
          onClose={() => setSelectedSensor(null)}
        />
      )}
    </div>
  );
}
