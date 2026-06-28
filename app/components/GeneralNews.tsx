"use client";

import { useEffect, useState } from "react";

interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  publishedAt: number;
  sentiment?: "positive" | "negative" | "neutral";
}

function SentimentDot({ sentiment }: { sentiment?: string }) {
  if (sentiment === "positive") return <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 mt-1" />;
  if (sentiment === "negative") return <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1" />;
  return null;
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

export default function GeneralNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news?general=1")
      .then((r) => r.json())
      .then((data) => setNews(data.news ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && news.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent mb-4">
        General financial news
      </h2>
      <div className="bg-gray-900 rounded-xl p-4">
        {loading ? (
          <p className="text-gray-700 text-xs">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {news.map((item, i) => (
              <a
                key={i}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col group rounded-lg hover:bg-gray-800 p-2 -m-2 transition-colors"
              >
                <div className="flex items-start gap-1.5">
                  <SentimentDot sentiment={item.sentiment} />
                  <p className="text-gray-200 text-xs font-medium leading-snug group-hover:text-white transition-colors line-clamp-2">
                    {item.title}
                  </p>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  {item.publisher}
                  {item.publishedAt > 0 && <> · {timeAgo(item.publishedAt)}</>}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
