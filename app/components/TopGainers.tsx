"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "./SettingsContext";

interface Gainer {
  symbol: string;
  name: string;
  gain: number;
  region?: string;
}

interface Props {
  regions?: string[];
}

const RANK_COLORS = [
  "text-amber-500",
  "text-slate-400",
  "text-orange-400",
];

const SUFFIX_MARKET: Record<string, { code: string; name: string }> = {
  ".AS": { code: "AMS", name: "Euronext Amsterdam" },
  ".PA": { code: "PAR", name: "Euronext Paris" },
  ".DE": { code: "FRA", name: "Frankfurt Stock Exchange" },
  ".MU": { code: "FRA", name: "Frankfurt Stock Exchange" },
  ".L":  { code: "LON", name: "London Stock Exchange" },
  ".SW": { code: "SWX", name: "SIX Swiss Exchange" },
  ".CO": { code: "CPH", name: "Nasdaq Copenhagen" },
  ".HE": { code: "HEL", name: "Nasdaq Helsinki" },
  ".OL": { code: "OSL", name: "Oslo Stock Exchange" },
  ".ST": { code: "STO", name: "Nasdaq Stockholm" },
  ".BR": { code: "BRU", name: "Euronext Brussels" },
  ".VI": { code: "VIE", name: "Vienna Stock Exchange" },
  ".MI": { code: "MIL", name: "Borsa Italiana" },
  ".MC": { code: "MAD", name: "Bolsa de Madrid" },
  ".T":  { code: "TYO", name: "Tokyo Stock Exchange" },
  ".HK": { code: "HKG", name: "Hong Kong Stock Exchange" },
  ".KS": { code: "KRX", name: "Korea Exchange" },
  ".KQ": { code: "KRX", name: "Korea Exchange (KOSDAQ)" },
  ".NS": { code: "NSE", name: "National Stock Exchange of India" },
  ".BO": { code: "BSE", name: "Bombay Stock Exchange" },
  ".SI": { code: "SGX", name: "Singapore Exchange" },
  ".AX": { code: "ASX", name: "Australian Securities Exchange" },
  ".KL": { code: "KLS", name: "Bursa Malaysia" },
  ".TW": { code: "TWS", name: "Taiwan Stock Exchange" },
};

function marketInfo(symbol: string): { code: string; name: string } {
  const dot = symbol.lastIndexOf(".");
  if (dot < 0) return { code: "US", name: "NYSE / Nasdaq" };
  const suffix = symbol.slice(dot);
  return SUFFIX_MARKET[suffix] ?? { code: suffix.slice(1).toUpperCase(), name: suffix.slice(1).toUpperCase() };
}

export default function TopGainers({ regions = ["AMER", "EMEA", "APAC"] }: Props) {
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
    <div ref={containerRef} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm min-w-0 shrink">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
          {t.topGainersTitle}
        </h2>
        <span className="text-gray-300 text-xs">{t.last3Months}</span>
      </div>

      {loading ? (
        <p className="text-gray-400 text-xs">{t.loading}</p>
      ) : gainers.length === 0 ? (
        <p className="text-gray-400 text-xs">{t.noData}</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
          {filtered.map((g, i) => {
            const barWidth = Math.round((Math.abs(g.gain) / maxGain) * 100);
            const positive = g.gain >= 0;
            return (
              <div key={g.symbol} className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-bold w-4 shrink-0 tabular-nums ${RANK_COLORS[i] ?? "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <span
                    className="relative text-gray-900 text-xs font-bold truncate min-w-0 cursor-default"
                    onMouseEnter={() => setOpenTip(`name-${g.symbol}`)}
                    onMouseLeave={() => setOpenTip(null)}
                    onClick={() => setOpenTip(openTip === `name-${g.symbol}` ? null : `name-${g.symbol}`)}
                  >
                    {g.name}
                    {openTip === `name-${g.symbol}` && (
                      <span className="absolute bottom-full mb-1.5 left-0 whitespace-nowrap bg-gray-900 text-white text-xs rounded px-2 py-1 z-20 pointer-events-none">
                        {g.symbol}
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
                          onMouseEnter={() => setOpenTip(tipId)}
                          onMouseLeave={() => setOpenTip(null)}
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
