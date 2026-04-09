"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import type { NominatimResult, SearchWeatherData } from "@/types";
import WeatherCard from "./WeatherCard";

interface SearchBarProps {
  onSelect: (result: NominatimResult) => void;
  onClear: () => void;
  weather: SearchWeatherData | null;
  weatherLoading: boolean;
  onWeatherClose: () => void;
}

export default function SearchBar({ onSelect, onClear, weather, weatherLoading, onWeatherClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      const data: NominatimResult[] = await res.json();
      setSuggestions(data);
      setIsOpen(data.length > 0);
      setSelectedIndex(-1);
    } catch {
      // ignore
    }
  }, []);

  const handleInput = (value: string) => {
    setQuery(value);
    setSelectedName(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 400);
  };

  const handleSelect = (result: NominatimResult) => {
    const shortName = result.display_name.split(",").slice(0, 2).join(",").trim();
    setQuery(shortName);
    setSelectedName(shortName);
    setSuggestions([]);
    setIsOpen(false);
    onSelect(result);
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setSelectedName(null);
    onClear();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handler = () => setIsOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-[90%] md:w-[400px]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search input */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && !selectedName && setIsOpen(true)}
          placeholder="Search address or city..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-black/60 backdrop-blur-xl border border-white/10 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 transition-colors"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={14} className="text-white/40" />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="mt-1 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl">
          {suggestions.map((result, i) => {
            const parts = result.display_name.split(",");
            const main = parts.slice(0, 2).join(",").trim();
            const sub = parts.slice(2).join(",").trim();
            return (
              <button
                key={result.place_id}
                onClick={() => handleSelect(result)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-white/5 last:border-0 ${
                  i === selectedIndex ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                }`}
              >
                <p className="font-medium truncate">{main}</p>
                {sub && <p className="text-[10px] text-white/40 truncate">{sub}</p>}
              </button>
            );
          })}
        </div>
      )}

      {/* Weather card */}
      {weatherLoading && selectedName && (
        <div className="mt-2 rounded-xl bg-black/70 backdrop-blur-xl border border-white/10 p-4 text-center">
          <div className="w-5 h-5 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-white/40">Loading weather...</p>
        </div>
      )}
      {weather && !weatherLoading && (
        <div className="mt-2">
          <WeatherCard weather={weather} onClose={onWeatherClose} />
        </div>
      )}
    </div>
  );
}
