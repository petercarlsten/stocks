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

const CHIP_COLORS = [
  "bg-indigo-50 text-indigo-700 border-indigo-200",
  "bg-violet-50 text-violet-700 border-violet-200",
  "bg-emerald-50 text-emerald-700 border-emerald-200",
  "bg-blue-50 text-blue-700 border-blue-200",
  "bg-amber-50 text-amber-700 border-amber-200",
  "bg-rose-50 text-rose-700 border-rose-200",
  "bg-teal-50 text-teal-700 border-teal-200",
  "bg-orange-50 text-orange-700 border-orange-200",
];

interface Stock { symbol: string; name: string }

export default function AllStocksNews({ stocks }: { stocks: Stock[] }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  const newsStocks = stocks.filter((s) => !s.symbol.startsWith("0P"));

  useEffect(() => {
    if (newsStocks.length === 0) { setLoading(false); return; }
    setLoading(true);
    setNews([]);
    const symbols = newsStocks.map((s) => s.symbol).join(",");
    const names = newsStocks.map((s) => s.name).join("|");
    fetch(`/api/news?${new URLSearchParams({ symbols, names })}`)
      .then((r) => r.json())
      .then((data) => setNews(data.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [newsStocks.map((s) => s.symbol).join(",")]);

  if (!loading && news.length === 0) return null;

  const symbolList = [...new Set(news.map((n) => n.symbol))].sort();
  const colorMap = Object.fromEntries(
    symbolList.map((sym, i) => [sym, CHIP_COLORS[i % CHIP_COLORS.length]])
  );

  // Group by ticker, sorted alphabetically; filter collapses to one group
  const groups = (filter ? symbolList.filter((s) => s === filter) : symbolList)
    .map((sym) => ({
      symbol: sym,
      name: news.find((n) => n.symbol === sym)?.name ?? sym,
      items: news.filter((n) => n.symbol === sym),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent">
          News related to your portfolio
        </h2>
        {symbolList.length > 1 && !loading && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter(null)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                filter === null
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              All
            </button>
            {symbolList.map((sym) => (
              <button
                key={sym}
                onClick={() => setFilter(filter === sym ? null : sym)}
                className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  filter === sym
                    ? "bg-gray-800 text-white border-gray-800"
                    : `${colorMap[sym]} hover:opacity-75`
                }`}
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="text-gray-400 text-xs">Loading news…</p>}

      {!loading && (
        <div className="flex flex-col divide-y divide-gray-100">
          {groups.map((group) => (
            <div key={group.symbol} className="py-3 first:pt-0 last:pb-0">
              {/* Ticker divider */}
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${colorMap[group.symbol] ?? CHIP_COLORS[0]}`}>
                  {group.symbol}
                </span>
                <span className="text-gray-400 text-xs truncate">{group.name}</span>
              </div>
              {/* Articles — 1 col on mobile, 3 on desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-x-4 gap-y-1">
                {group.items.map((item, i) => (
                  <a
                    key={i}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 py-1.5 hover:bg-gray-50 -mx-1 px-1 rounded transition-colors group"
                  >
                    {item.thumbnail && (
                      <img
                        src={item.thumbnail}
                        alt=""
                        className="w-10 h-8 object-cover rounded shrink-0 opacity-80 group-hover:opacity-100 transition-opacity mt-0.5"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-xs font-medium leading-snug group-hover:text-gray-900 line-clamp-2">
                        {item.title}
                      </p>
                      <p className="text-gray-400 text-xs mt-0.5">
                        {item.publisher}{item.publishedAt > 0 && <> · {timeAgo(item.publishedAt)}</>}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
