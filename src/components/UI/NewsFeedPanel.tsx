"use client";

import { useEffect, useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import type { NewsArticle, NewsCategory } from "@/types";
import { NEWS_CATEGORIES } from "@/types";
import LiveStreamPlayer from "./LiveStreamPlayer";

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface NewsFeedPanelProps {
  articles: NewsArticle[];
  activeCategory: NewsCategory | "all";
  onCategoryChange: (cat: NewsCategory | "all") => void;
  onArticleClick: (article: NewsArticle) => void;
  onClose: () => void;
  selectedArticleId: string | null;
  flyToLocation: ((lat: number, lon: number, alt: number) => void) | null;
}

export default function NewsFeedPanel({
  articles,
  activeCategory,
  onCategoryChange,
  onArticleClick,
  onClose,
  selectedArticleId,
  flyToLocation,
}: NewsFeedPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const articleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter articles by active category
  const filtered = activeCategory === "all"
    ? articles
    : articles.filter((a) => a.category === activeCategory);

  // Sort by most recent
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
  );

  // Scroll to selected article when it changes from globe pin click
  useEffect(() => {
    if (selectedArticleId) {
      const el = articleRefs.current.get(selectedArticleId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setExpandedId(selectedArticleId);
      }
    }
  }, [selectedArticleId]);

  const handleArticleClick = (article: NewsArticle) => {
    setExpandedId(expandedId === article.id ? null : article.id);
    onArticleClick(article);
    flyToLocation?.(article.latitude, article.longitude, 2_000_000);
  };

  const tabs: { key: NewsCategory | "all"; label: string; color: string }[] = [
    { key: "all", label: "All", color: "#AAAAAA" },
    ...NEWS_CATEGORIES,
  ];

  return (
    <div className="fixed top-0 right-0 h-screen w-[380px] bg-black/85 backdrop-blur-xl border-l border-white/10 text-white z-20 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <h2 className="text-sm font-bold tracking-wide uppercase">Live News</h2>
          <span className="text-xs text-white/40">{articles.length} articles</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
        >
          <X size={16} className="text-white/50" />
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-white/5 shrink-0">
        {tabs.map(({ key, label, color }) => {
          const isActive = activeCategory === key;
          return (
            <button
              key={key}
              onClick={() => onCategoryChange(key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all border ${
                isActive
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-transparent text-white/40 hover:text-white/60"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color, opacity: isActive ? 1 : 0.4 }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* Article list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="text-center text-sm text-white/30 py-8">No articles in this category</p>
        ) : (
          sorted.map((article) => {
            const cat = NEWS_CATEGORIES.find((c) => c.key === article.category);
            const isExpanded = expandedId === article.id;
            const isSelected = selectedArticleId === article.id;

            return (
              <div
                key={article.id}
                ref={(el) => { if (el) articleRefs.current.set(article.id, el); }}
                onClick={() => handleArticleClick(article)}
                className={`px-4 py-3 border-b border-white/5 cursor-pointer transition-colors ${
                  isSelected ? "bg-white/10 border-l-2 border-l-white/40" : "hover:bg-white/5"
                }`}
              >
                <div className="flex gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat?.color || "#fff" }}
                      />
                      <span className="text-[9px] uppercase tracking-wider font-medium" style={{ color: cat?.color || "#fff" }}>
                        {cat?.label || article.category}
                      </span>
                    </div>
                    <h3 className="text-xs font-semibold leading-tight line-clamp-2 mb-1">
                      {article.title}
                    </h3>
                    <p className="text-[10px] text-white/40">
                      {article.source} {article.publishDate && `· ${timeAgo(article.publishDate)}`}
                    </p>
                  </div>

                  {/* Thumbnail */}
                  {article.image && !isExpanded && (
                    <img
                      src={article.image}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  )}
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {article.image && (
                      <img
                        src={article.image}
                        alt=""
                        className="w-full max-h-40 rounded-lg object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    {article.location && (
                      <p className="text-[10px] text-white/40">
                        Location: {article.location}
                      </p>
                    )}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-medium hover:bg-blue-500/30 transition-colors"
                    >
                      <ExternalLink size={12} />
                      Read Full Article
                    </a>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Live News Streams */}
      <LiveStreamPlayer />
    </div>
  );
}
