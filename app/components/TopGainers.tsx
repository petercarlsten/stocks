"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "./SettingsContext";

interface Gainer {
  symbol: string;
  name: string;
  gain: number;
}

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

  return (
    <div className="bg-white rounded-xl p-4 w-96 shrink-0 border border-gray-200 shadow-sm">
      <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-1">
        {t.topGainersTitle}
      </h2>
      <p className="text-gray-400 text-xs mb-3">{t.last3Months}</p>
      {loading ? (
        <p className="text-gray-600 text-xs">{t.loading}</p>
      ) : gainers.length === 0 ? (
        <p className="text-gray-600 text-xs">{t.noData}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {gainers.map((g, i) => (
            <li key={g.symbol} className="flex items-center gap-2 min-w-0">
              <span className="text-gray-300 text-xs w-3 shrink-0">{i + 1}</span>
              <span className="text-gray-900 text-sm font-medium truncate flex-1" title={g.name}>{g.name}</span>
              <span className={`text-sm font-medium shrink-0 ${g.gain >= 0 ? "text-green-600" : "text-red-500"}`}>
                {g.gain >= 0 ? "+" : ""}{g.gain.toFixed(1)}%
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
