"use client";

import { useMemo } from "react";
import { X, Trash2 } from "lucide-react";
import type { BuoyData } from "@/lib/bayouBuoyRenderer";
import { generateReading } from "@/lib/bayouBuoySimulator";

interface BuoyCompareViewProps {
  buoys: BuoyData[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

const COMPARE_COLORS = ["#22D3EE", "#FB923C", "#A78BFA", "#34D399"];

type SeriesPoint = {
  salinityPpt: number;
  waterTempC: number;
  dissolvedOxygenMgL: number;
  depthM: number;
};

interface BuoySeries {
  id: string;
  color: string;
  series: SeriesPoint[];
}

function buildSeries(buoys: BuoyData[]): BuoySeries[] {
  const now = Date.now();
  return buoys.map((b, i) => {
    const conditions = {
      hurricaneActive: b.hurricaneMode,
      spillBuoyIds: b.oilAlert ? [b.id] : [],
      algalBuoyIds: b.algalAlert ? [b.id] : [],
    };
    const series: SeriesPoint[] = [];
    for (let h = 23; h >= 0; h--) {
      const t = now - h * 3_600_000;
      const r = generateReading(b, t, conditions);
      series.push({
        salinityPpt: r.salinityPpt,
        waterTempC: r.waterTempC,
        dissolvedOxygenMgL: r.dissolvedOxygenMgL,
        depthM: r.depthM,
      });
    }
    return { id: b.id, color: COMPARE_COLORS[i % COMPARE_COLORS.length], series };
  });
}

interface MultiLineChartProps {
  label: string;
  unit: string;
  series: Array<{ id: string; color: string; values: number[] }>;
}

function MultiLineChart({ label, unit, series }: MultiLineChartProps) {
  const allValues = series.flatMap((s) => s.values);
  if (allValues.length < 2) return null;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || Math.max(0.1, Math.abs(max) * 0.05);
  const w = 600;
  const h = 100;
  const pad = { l: 44, r: 12, t: 10, b: 20 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
        <span className="text-[10px] text-white/40">{unit}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ aspectRatio: `${w}/${h}` }}>
        <text x={pad.l - 4} y={pad.t + 6} textAnchor="end" fontSize="9" className="fill-white/40 font-mono">{max.toFixed(1)}</text>
        <text x={pad.l - 4} y={pad.t + ch + 4} textAnchor="end" fontSize="9" className="fill-white/40 font-mono">{min.toFixed(1)}</text>
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + ch} stroke="white" strokeOpacity="0.12" />
        <line x1={pad.l} y1={pad.t + ch} x2={pad.l + cw} y2={pad.t + ch} stroke="white" strokeOpacity="0.12" />
        <text x={pad.l} y={h - 4} fontSize="9" className="fill-white/40">24h ago</text>
        <text x={pad.l + cw} y={h - 4} textAnchor="end" fontSize="9" className="fill-white/40">now</text>
        {series.map((s) => {
          if (s.values.length < 2) return null;
          const points = s.values.map((v, i) => {
            const x = pad.l + (i / (s.values.length - 1)) * cw;
            const y = pad.t + ch - ((v - min) / range) * ch;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ");
          const lastV = s.values[s.values.length - 1];
          const lastY = pad.t + ch - ((lastV - min) / range) * ch;
          return (
            <g key={s.id}>
              <polyline fill="none" stroke={s.color} strokeWidth="1.5" points={points} vectorEffect="non-scaling-stroke" />
              <circle cx={pad.l + cw} cy={lastY} r="2.5" fill={s.color} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface StatRow {
  label: string;
  unit: string;
  key: keyof BuoyData;
  decimals?: number;
}

const STAT_ROWS: StatRow[] = [
  { label: "Salinity", unit: "ppt", key: "salinityPpt", decimals: 1 },
  { label: "Water Temp", unit: "°C", key: "waterTempC", decimals: 1 },
  { label: "Air Temp", unit: "°C", key: "airTempC", decimals: 1 },
  { label: "Dissolved O₂", unit: "mg/L", key: "dissolvedOxygenMgL", decimals: 1 },
  { label: "Depth", unit: "m", key: "depthM", decimals: 2 },
  { label: "Wave Height", unit: "ft", key: "waveHeightFt", decimals: 1 },
  { label: "Wind", unit: "kts", key: "windSpeedKts", decimals: 0 },
  { label: "Barometric", unit: "mb", key: "barometricMb", decimals: 0 },
  { label: "pH", unit: "", key: "pH", decimals: 2 },
  { label: "Turbidity", unit: "NTU", key: "turbidityNtu", decimals: 0 },
  { label: "Oil Fluor.", unit: "ppb", key: "oilFluorescencePpb", decimals: 0 },
  { label: "Chlorophyll", unit: "µg/L", key: "chlorophyllUgL", decimals: 1 },
];

function statusOf(b: BuoyData): { label: string; color: string } {
  if (!b.online) return { label: "OFFLINE", color: "#888888" };
  if (b.oilAlert) return { label: "OIL", color: "#FF3300" };
  if (b.hurricaneMode) return { label: "HURRICANE", color: "#FFAA00" };
  if (b.algalAlert) return { label: "ALGAL", color: "#00FF88" };
  return { label: "ONLINE", color: "#22C55E" };
}

export default function BuoyCompareView({ buoys, onClose, onRemove, onClear }: BuoyCompareViewProps) {
  const buoySeries = useMemo(() => buildSeries(buoys), [buoys]);

  if (buoys.length === 0) return null;

  // Build per-row "best" highlighting: highest of the row gets a subtle accent
  const findRowExtreme = (key: keyof BuoyData): { hi: number; lo: number } => {
    const vs = buoys.map((b) => b[key] as number);
    return { hi: Math.max(...vs), lo: Math.min(...vs) };
  };

  const cols = buoys.length;
  const gridCls =
    cols === 1 ? "grid-cols-1"
    : cols === 2 ? "grid-cols-2"
    : cols === 3 ? "grid-cols-3"
    : "grid-cols-2 md:grid-cols-4";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-black/95 border border-white/15 text-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-5 py-3 border-b border-white/10 flex items-center justify-between sticky top-0 bg-black/95 backdrop-blur-md z-10">
          <div>
            <h3 className="text-lg font-bold">Compare Buoys</h3>
            <p className="text-xs text-white/50">{buoys.length} of 4 selected</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClear}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/60 hover:text-red-300 border border-white/10 hover:border-red-400/30 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={11} /> Clear All
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={18} className="text-white/60" />
            </button>
          </div>
        </header>

        {/* Buoy header cards */}
        <div className={`grid gap-2 p-4 border-b border-white/5 ${gridCls}`}>
          {buoys.map((b, i) => {
            const color = COMPARE_COLORS[i % COMPARE_COLORS.length];
            const status = statusOf(b);
            return (
              <div key={b.id} className="relative rounded-xl bg-white/5 border border-white/10 p-3">
                <button
                  onClick={() => onRemove(b.id)}
                  className="absolute top-1.5 right-1.5 p-0.5 rounded hover:bg-white/15 transition-colors"
                  title="Remove from compare"
                >
                  <X size={12} className="text-white/40 hover:text-white/80" />
                </button>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-white/40 uppercase tracking-wider">{b.parish.slice(0, 2).toUpperCase()}</span>
                </div>
                <p className="text-sm font-bold font-mono leading-tight">{b.id}</p>
                <p className="text-[10px] text-white/50 truncate mt-0.5">{b.basin}</p>
                <p
                  className="text-[9px] font-bold uppercase tracking-wider mt-1.5"
                  style={{ color: status.color }}
                >
                  {status.label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stats table */}
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Live Sensor Comparison</p>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[9px] uppercase tracking-wider text-white/40 border-b border-white/10">
                  <th className="text-left py-1.5 pr-3 font-medium">Sensor</th>
                  {buoys.map((b, i) => (
                    <th
                      key={b.id}
                      className="text-right py-1.5 pl-2 pr-2 font-medium font-mono"
                      style={{ color: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
                    >
                      {b.id}
                    </th>
                  ))}
                  <th className="text-right py-1.5 pl-2 pr-1 font-medium text-white/30">Unit</th>
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map((row) => {
                  const { hi, lo } = findRowExtreme(row.key);
                  return (
                    <tr key={row.label} className="border-b border-white/5 last:border-0">
                      <td className="py-1.5 pr-3 text-white/60">{row.label}</td>
                      {buoys.map((b) => {
                        const v = b[row.key] as number;
                        const isHi = cols > 1 && v === hi && hi !== lo;
                        const isLo = cols > 1 && v === lo && hi !== lo;
                        return (
                          <td
                            key={b.id}
                            className={`py-1.5 pl-2 pr-2 text-right font-mono ${
                              isHi ? "text-cyan-300 font-bold" : isLo ? "text-white/40" : "text-white"
                            }`}
                          >
                            {v.toFixed(row.decimals ?? 1)}
                          </td>
                        );
                      })}
                      <td className="py-1.5 pl-2 pr-1 text-right text-white/30 text-[10px]">{row.unit}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {cols > 1 && (
            <p className="text-[9px] text-white/30 mt-2">
              <span className="text-cyan-300">cyan</span> = highest in row · <span className="text-white/40">grey</span> = lowest
            </p>
          )}
        </div>

        {/* Multi-line charts */}
        <div className="px-4 py-4 space-y-4">
          <p className="text-[10px] uppercase tracking-wider text-white/40">24-Hour Overlays</p>
          <MultiLineChart
            label="Salinity"
            unit="ppt"
            series={buoySeries.map((bs) => ({ id: bs.id, color: bs.color, values: bs.series.map((p) => p.salinityPpt) }))}
          />
          <MultiLineChart
            label="Water Temperature"
            unit="°C"
            series={buoySeries.map((bs) => ({ id: bs.id, color: bs.color, values: bs.series.map((p) => p.waterTempC) }))}
          />
          <MultiLineChart
            label="Dissolved Oxygen"
            unit="mg/L"
            series={buoySeries.map((bs) => ({ id: bs.id, color: bs.color, values: bs.series.map((p) => p.dissolvedOxygenMgL) }))}
          />
          <MultiLineChart
            label="Depth (Tide)"
            unit="m"
            series={buoySeries.map((bs) => ({ id: bs.id, color: bs.color, values: bs.series.map((p) => p.depthM) }))}
          />
        </div>
      </div>
    </div>
  );
}
