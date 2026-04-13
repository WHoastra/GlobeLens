"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Search, BarChart3 } from "lucide-react";
import type { CountryStat, StatsResponse, StatCategory, StatIndicator } from "@/types/stats";
import { STAT_CATEGORIES, formatStatValue, countryFlag } from "@/types/stats";

interface StatsPanelProps {
  onClose: () => void;
  selectedCountryCode: string | null;
  onStatsDataChange: (data: CountryStat[], colorScale: [string, string]) => void;
  onCountrySelect: (iso3: string) => void;
  flyToCountry: ((iso3: string) => void) | null;
  inline?: boolean; // true for mobile bottom sheet (no fixed positioning)
}

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

export default function StatsPanel({
  onClose,
  selectedCountryCode,
  onStatsDataChange,
  onCountrySelect,
  flyToCountry,
  inline = false,
}: StatsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<StatCategory>(STAT_CATEGORIES[0]);
  const [activeIndicator, setActiveIndicator] = useState<StatIndicator>(STAT_CATEGORIES[0].indicators[0]);
  const [countries, setCountries] = useState<CountryStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const countryRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const onStatsDataChangeRef = useRef(onStatsDataChange);
  onStatsDataChangeRef.current = onStatsDataChange;

  // Fetch data when indicator changes
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/stats?indicator=${activeIndicator.code}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch stats");
        return res.json();
      })
      .then((data: StatsResponse) => {
        const sorted = [...data.countries].sort((a, b) => b.value - a.value);
        setCountries(sorted);
        onStatsDataChangeRef.current(sorted, activeCategory.colorScale);
      })
      .catch(e => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [activeIndicator.code, activeCategory.colorScale]);

  // Scroll to selected country when globe click selects one
  useEffect(() => {
    if (selectedCountryCode) {
      const el = countryRefs.current.get(selectedCountryCode);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [selectedCountryCode]);

  const handleCategoryChange = useCallback((cat: StatCategory) => {
    setActiveCategory(cat);
    setActiveIndicator(cat.indicators[0]);
  }, []);

  const handleCountryClick = useCallback((country: CountryStat) => {
    onCountrySelect(country.countryCode);
    flyToCountry?.(country.countryCode);
  }, [onCountrySelect, flyToCountry]);

  const filtered = search
    ? countries.filter(c => c.countryName.toLowerCase().includes(search.toLowerCase()))
    : countries;

  const rankMap = new Map(countries.map((c, i) => [c.countryCode, i + 1]));

  return (
    <div className={inline
      ? "flex flex-col h-full text-white"
      : "fixed top-0 right-0 h-screen w-[400px] bg-black/85 backdrop-blur-xl border-l border-white/10 text-white z-20 flex flex-col shadow-2xl"
    }>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-emerald-400" />
          <h2 className="text-sm font-bold tracking-wide uppercase">Global Statistics</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
          <X size={16} className="text-white/50" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5 shrink-0">
        {STAT_CATEGORIES.map(cat => (
          <button
            key={cat.key}
            onClick={() => handleCategoryChange(cat)}
            className={`px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all border ${
              activeCategory.key === cat.key
                ? "border-white/30 bg-white/10 text-white"
                : "border-transparent text-white/40 hover:text-white/60"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Indicator sub-tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5 shrink-0">
        {activeCategory.indicators.map(ind => (
          <button
            key={ind.code}
            onClick={() => setActiveIndicator(ind)}
            className={`px-2.5 py-1 rounded text-[10px] font-medium shrink-0 transition-all border ${
              activeIndicator.code === ind.code
                ? "bg-white/10 border-white/30 text-white"
                : "bg-white/5 border-white/10 text-white/40 hover:text-white/60"
            }`}
          >
            {ind.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Search size={14} className="text-white/30 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
          />
        </div>
      </div>

      {/* Rankings list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <div className="w-4 h-4 border-2 border-white/20 border-t-emerald-400 rounded-full animate-spin" />
            <span className="text-sm text-white/50">Loading data...</span>
          </div>
        ) : error ? (
          <p className="text-center text-sm text-red-400 py-8">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-white/30 py-8">No results</p>
        ) : (
          filtered.map(country => {
            const rank = rankMap.get(country.countryCode) ?? 0;
            const isTop3 = rank <= 3;
            const isSelected = selectedCountryCode === country.countryCode;
            const isUS = country.countryCode2 === "US";

            return (
              <div
                key={country.countryCode}
                ref={el => { if (el) countryRefs.current.set(country.countryCode, el); }}
                onClick={() => handleCountryClick(country)}
                className={`flex items-center gap-3 px-4 py-2.5 border-b border-white/5 cursor-pointer transition-colors ${
                  isSelected ? "bg-white/10 border-l-2 border-l-emerald-400" :
                  isUS ? "bg-blue-500/5 hover:bg-blue-500/10" :
                  "hover:bg-white/5"
                }`}
              >
                <span
                  className={`w-7 text-right text-xs font-mono font-bold shrink-0 ${isTop3 ? "" : "text-white/40"}`}
                  style={isTop3 ? { color: MEDAL_COLORS[rank - 1] } : undefined}
                >
                  {rank}
                </span>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-base shrink-0">{countryFlag(country.countryCode2)}</span>
                  <span className={`text-xs truncate ${isUS ? "font-semibold text-blue-300" : "font-medium"}`}>
                    {country.countryName}
                  </span>
                </div>
                <span className={`text-xs font-mono shrink-0 ${isTop3 ? "font-bold" : "text-white/60"}`}>
                  {formatStatValue(country.value, activeIndicator.format)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/10 shrink-0">
        <p className="text-[9px] text-white/30">
          Source: World Bank Open Data{countries.length > 0 ? ` · ${countries[0]?.year}` : ""}
          {countries.length > 0 ? ` · ${countries.length} countries` : ""}
        </p>
      </div>
    </div>
  );
}
