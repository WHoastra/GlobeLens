"use client";

import { ExternalLink } from "lucide-react";
import type { NewsArticle } from "@/types";

interface NewsPanelProps {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
}

export default function NewsPanel({ articles, loading, error }: NewsPanelProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-white/50">
        <div className="w-4 h-4 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
        Fetching news...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-400">{error}</p>;
  }

  if (articles.length === 0) {
    return <p className="text-sm text-white/40">No news found for this area.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/40 uppercase tracking-wide">
        {articles.length} headline{articles.length !== 1 ? "s" : ""} nearby
      </p>
      {articles.map((article) => (
        <a
          key={article.id}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg bg-white/5 p-3 hover:bg-white/10 transition-colors group"
        >
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-snug line-clamp-2">
              {article.title}
            </h4>
            <ExternalLink size={12} className="text-white/30 group-hover:text-white/60 shrink-0 mt-0.5" />
          </div>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-white/40">
            <span>{article.source}</span>
            {article.publishDate && (
              <>
                <span>·</span>
                <span>{new Date(article.publishDate).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
