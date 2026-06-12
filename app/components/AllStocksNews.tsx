"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  symbol: string;
  name: string;
  title: string;
  description: string | null;
  publisher: string;
  link: string;
  publishedAt: number;
  thumbnail: string | null;
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

interface Stock { symbol: string; name: string }

export default function AllStocksNews({ stocks }: { stocks: Stock[] }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const newsStocks = stocks.filter((s) => !s.symbol.startsWith("0P"));
    if (newsStocks.length === 0) { setLoading(false); return; }

    setLoading(true);
    setNews([]);

    const symbols = newsStocks.map((s) => s.symbol).join(",");
    const names = newsStocks.map((s) => s.name).join(",");
    const params = new URLSearchParams({ symbols, names });

    fetch(`/api/news?${params}`)
      .then((r) => r.json())
      .then((data) => setNews(data.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stocks.filter((s) => !s.symbol.startsWith("0P")).map((s) => s.symbol).join(",")]);

  if (!loading && news.length === 0) return null;

  const bySymbol = stocks
    .map((s) => ({ ...s, items: news.filter((n) => n.symbol === s.symbol) }))
    .filter((s) => s.items.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
        News related to your stocks <span className="text-gray-500">(a bit funky)</span>
      </h2>
      {loading && (
        <p className="text-gray-700 text-xs">Loading news…</p>
      )}
      {!loading && bySymbol.map((s) => (
        <div key={s.symbol} className="bg-gray-900 rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-white font-semibold text-sm">{s.name}</span>
            <span className="text-gray-500 text-xs">{s.symbol}</span>
            <span className="text-gray-600 text-xs ml-1">· News</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {s.items.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex gap-3 group rounded-lg hover:bg-gray-800 p-2 -m-2 transition-colors"
              >
                {item.thumbnail && (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-14 h-10 object-cover rounded shrink-0 opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-gray-200 text-xs font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-gray-400 text-xs leading-snug mt-1 line-clamp-2">
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
        </div>
      ))}
    </div>
  );
}
