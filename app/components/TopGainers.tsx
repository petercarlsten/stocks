"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "./SettingsContext";

interface Gainer {
  symbol: string;
  name: string;
  gain: number;
}

const RANK_COLORS = [
  "text-amber-500",
  "text-slate-400",
  "text-orange-400",
];

export default function TopGainers() {
  const t = useTranslation();
  const [gainers, setGainers] = useState<Gainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/top-gainers")
      .then((r) => r.json())
      .then((data) => { setGainers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const maxGain = gainers.length > 0 ? Math.max(...gainers.map((g) => Math.abs(g.gain))) : 1;

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm min-w-0 shrink">
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
          {gainers.map((g, i) => {
            const barWidth = Math.round((Math.abs(g.gain) / maxGain) * 100);
            const positive = g.gain >= 0;
            return (
              <div key={g.symbol} className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`text-xs font-bold w-4 shrink-0 tabular-nums ${RANK_COLORS[i] ?? "text-gray-300"}`}>
                    {i + 1}
                  </span>
                  <span className="text-gray-900 text-xs font-bold shrink-0">{g.symbol}</span>
                  <span className={`text-xs font-semibold shrink-0 ml-auto tabular-nums ${positive ? "text-green-600" : "text-red-500"}`}>
                    {positive ? "+" : ""}{g.gain.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <span className="w-4 shrink-0" />
                  <div className="flex-1 min-w-0 relative h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full ${positive ? "bg-green-400" : "bg-red-400"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <span className="text-gray-400 text-xs truncate min-w-0 max-w-16" title={g.name}>{g.name.split(" ")[0]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
