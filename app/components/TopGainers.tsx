"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "./SettingsContext";
import { marketInfo } from "../lib/marketInfo";

interface Gainer {
  symbol: string;
  name: string;
  gain: number;
  region?: string;
}

interface Props {
  regions?: string[];
  onRegionsChange?: (regions: string[]) => void;
  columns?: 2 | 3;
  className?: string;
}

const RANK_COLORS = [
  "text-amber-500",
  "text-slate-400",
  "text-orange-400",
];


export default function TopGainers({ regions = ["AMER", "EMEA", "APAC"], onRegionsChange, columns = 2, className = "" }: Props) {
  const t = useTranslation();
  const [gainers, setGainers] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/top-gainers")
      .then((r) => r.json())
      .then((data) => { setGainers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = gainers.filter(g => g.gain >= 0 && (!g.region || regions.includes(g.region))).slice(0, 9);
  const maxGain = filtered.length > 0 ? Math.max(...filtered.map((g) => Math.abs(g.gain))) : 1;
  const [openTip, setOpenTip] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenTip(null);
      }
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("touchstart", handler); };
  }, []);

  return (
    <div ref={containerRef} className={`bg-white rounded-xl p-4 border border-gray-200 shadow-sm w-96 ${className}`}>
      <div className="flex items-baseline gap-2 mb-3 flex-wrap">
        <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          {t.topGainersTitle}
        </h2>
        <span className="text-gray-300 text-xs">{t.last3Months}</span>
        <div className="flex gap-1 ml-auto">
          {(["AMER", "EMEA", "APAC"] as const).map((r) => {
            const active = regions.includes(r);
            return (
              <button
                key={r}
                onClick={() => {
                  if (!onRegionsChange) return;
                  const next = active ? regions.filter(x => x !== r) : [...regions, r];
                  if (next.length > 0) onRegionsChange(next);
                }}
                className={`text-xs px-1.5 py-0.5 rounded font-medium transition-colors ${active ? "bg-indigo-100 text-indigo-600" : "bg-gray-100 text-gray-300"} ${onRegionsChange ? "cursor-pointer hover:opacity-75" : "cursor-default"}`}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-xs">{t.loading}</p>
      ) : gainers.length === 0 ? (
        <p className="text-gray-400 text-xs">{t.noData}</p>
      ) : (
        <div className={`grid gap-x-4 gap-y-1.5 ${columns === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {filtered.map((g, i) => {
            const barWidth = Math.round((Math.abs(g.gain) / maxGain) * 100);
            const positive = g.gain >= 0;
            return (
              <div key={g.symbol} className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-bold w-4 shrink-0 tabular-nums ${RANK_COLORS[i] ?? "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <span className="relative flex-1 min-w-0">
                    <span
                      className="block text-gray-900 text-xs font-bold truncate cursor-default"
                      onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpenTip(`name-${g.symbol}`); }}
                      onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpenTip(null); }}
                      onClick={() => setOpenTip(openTip === `name-${g.symbol}` ? null : `name-${g.symbol}`)}
                    >
                      {g.name}
                    </span>
                    {openTip === `name-${g.symbol}` && (
                      <span className="absolute bottom-full mb-1.5 left-0 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 z-50 pointer-events-none">
                        <span className="block">{g.name}</span>
                        <span className="block text-gray-400">{g.symbol}</span>
                      </span>
                    )}
                  </span>
                  <span className={`text-xs font-semibold shrink-0 ml-auto tabular-nums ${positive ? "text-green-600" : "text-red-500"}`}>
                    {positive ? "+" : ""}{g.gain.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-4 shrink-0" />
                  <div className="flex-1 min-w-0 relative h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${positive ? "bg-green-400" : "bg-red-400"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  {(() => {
                    const m = marketInfo(g.symbol);
                    const tipId = `mkt-${g.symbol}`;
                    return (
                      <div className="relative shrink-0">
                        <span
                          className="text-gray-400 text-xs cursor-default"
                          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpenTip(tipId); }}
                          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpenTip(null); }}
                          onClick={() => setOpenTip(openTip === tipId ? null : tipId)}
                        >
                          {m.code}
                        </span>
                        {openTip === tipId && (
                          <span className="absolute bottom-full mb-1.5 right-0 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 z-50 pointer-events-none">
                            {m.name}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
