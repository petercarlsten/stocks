"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  description: string | null;
  publisher: string;
  link: string;
  publishedAt: number;
  thumbnail: string | null;
  sentiment?: "positive" | "negative" | "neutral";
}

function sentimentBorder(sentiment?: string) {
  if (sentiment === "positive") return "border border-green-500/50";
  if (sentiment === "negative") return "border border-red-500/50";
  return "border border-transparent";
}

function timeAgo(unix: number): string {
  const seconds = Math.floor(Date.now() / 1000 - unix);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function StockNews({ symbol, name, maxItems = 10 }: { symbol: string; name: string; maxItems?: number }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setNews([]);
    const params = new URLSearchParams({ symbol });
    if (name) params.set("name", name);
    fetch(`/api/news?${params}`)
      .then((r) => r.json())
      .then((data) => setNews(data.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [symbol, name]);

  const visible = news.slice(0, maxItems);

  if (!loading && visible.length === 0) return null;

  return (
    <div className="bg-gray-900 rounded-xl p-4">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-white font-semibold text-sm">{name}</span>
        <span className="text-gray-500 text-xs">{symbol}</span>
        <span className="text-gray-600 text-xs ml-1">· News</span>
      </div>
      {loading ? (
        <p className="text-gray-700 text-xs">Loading…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((item, i) => (
            <a
              key={i}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex gap-3 group rounded-lg hover:bg-gray-800 p-2 transition-colors ${sentimentBorder(item.sentiment)}`}
            >
              {item.thumbnail && (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="w-14 h-10 object-cover rounded shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-gray-200 text-xs font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                  {item.title}
                </p>
                {item.description && (
                  <p className="text-gray-400 text-xs leading-snug mt-1 line-clamp-3">
                    {item.description}
                  </p>
                )}
                <p className="text-gray-500 text-xs mt-1">
                  {item.publisher}
                  {item.publishedAt > 0 && <> · {timeAgo(item.publishedAt)}</>}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
