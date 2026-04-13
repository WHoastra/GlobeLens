"use client";

import { X } from "lucide-react";
import { NEWS_CATEGORIES } from "@/types";
import type { NewsArticle } from "@/types";

interface NewsPanelProps {
  article: NewsArticle;
  onClose: () => void;
}

export default function NewsPanel({ article, onClose }: NewsPanelProps) {
  return (
    <div className="absolute bottom-4 left-80 z-10 w-80 rounded-xl border border-red-400/20 bg-black/70 backdrop-blur-xl text-white shadow-2xl p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: NEWS_CATEGORIES.find((c) => c.key === article.category)?.color || "#fff" }} />
          <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: NEWS_CATEGORIES.find((c) => c.key === article.category)?.color || "#fff" }}>
            {NEWS_CATEGORIES.find((c) => c.key === article.category)?.label || article.category}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-white/10 transition-colors shrink-0 ml-auto"
        >
          <X size={14} className="text-white/50" />
        </button>
      </div>
      <h3 className="text-sm font-semibold leading-snug mb-2">{article.title}</h3>
      <div className="flex items-center gap-2 text-xs text-white/40 mb-3">
        <span>{article.source}</span>
        {article.publishDate && (
          <>
            <span>·</span>
            <span>{article.publishDate}</span>
          </>
        )}
      </div>
      {article.image && (
        <img
          src={article.image}
          alt=""
          className="w-full h-32 object-cover rounded-lg mb-3"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center w-full py-2 rounded-lg bg-blue-500/15 border border-blue-400/30 text-blue-300 text-xs font-medium hover:bg-blue-500/25 transition-colors"
      >
        Read Full Article →
      </a>
    </div>
  );
}
