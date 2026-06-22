"use client";

import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "../lib/formatCurrency";

interface StockData {
  symbol: string;
  data: { date: string; close: number }[];
  purchases?: { date?: string; shares: number }[];
  currency?: string;
}

interface Props {
  stocks: StockData[];
  currency: string;
  exchangeRate: number;
  usdRates: Record<string, number>;
  theme?: "light" | "dark";
}

const COLORS = [
  "#6366f1", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  "#3b82f6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

export default function SectorChart({ stocks, currency, exchangeRate, usdRates, theme = "dark" }: Props) {
  const [sectors, setSectors] = useState<Record<string, string>>({});
  const dark = theme === "dark";

  const activeStocks = stocks.filter((s) =>
    (s.purchases ?? []).some((p) => p.shares > 0)
  );

  useEffect(() => {
    activeStocks.forEach((s) => {
      if (sectors[s.symbol]) return;
      fetch(`/api/sector?symbol=${encodeURIComponent(s.symbol)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.sector) setSectors((prev) => ({ ...prev, [s.symbol]: d.sector }));
        })
        .catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStocks.map((s) => s.symbol).join(",")]);

  if (activeStocks.length === 0) return null;

  // Group stocks by sector, summing current position values
  const sectorValues: Record<string, number> = {};
  for (const s of activeStocks) {
    const sector = sectors[s.symbol];
    if (!sector) continue;
    const shares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
    if (shares <= 0) continue;
    const price = s.data[s.data.length - 1]?.close ?? 0;
    const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
    const value = shares * price * (exchangeRate / tickerRate);
    sectorValues[sector] = (sectorValues[sector] ?? 0) + value;
  }

  const entries = Object.entries(sectorValues).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const data = entries.map(([name, value]) => ({ name, value, pct: (value / total) * 100 }));

  const bgColor = dark ? "#111827" : "#ffffff";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sector breakdown</span>
      <div className="flex items-center gap-4 mt-2">
        <ResponsiveContainer width={120} height={120}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={30}
              outerRadius={55}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: bgColor, border: "1px solid #374151", borderRadius: 8, fontSize: 11 }}
              formatter={(v: number, _: string, entry: { payload?: { name: string } }) => [
                formatCurrency(v, currency, 0),
                entry.payload?.name ?? "",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 min-w-0">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{d.name}</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 shrink-0">
                {d.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
