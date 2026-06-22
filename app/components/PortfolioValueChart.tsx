"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatCurrency } from "../lib/formatCurrency";

interface Purchase {
  date?: string;
  shares: number;
}

interface StockData {
  symbol: string;
  data: { date: string; close: number }[];
  purchases?: Purchase[];
  currency?: string;
}

interface Props {
  stocks: StockData[];
  currency: string;
  exchangeRate: number;
  usdRates: Record<string, number>;
  theme?: "light" | "dark";
}

type Range = "3m" | "1y";

function sharesOnDate(purchases: Purchase[], date: string): number {
  return purchases
    .filter((p) => !p.date || p.date <= date)
    .reduce((sum, p) => sum + p.shares, 0);
}

export default function PortfolioValueChart({ stocks, currency, exchangeRate, usdRates, theme = "dark" }: Props) {
  const [range, setRange] = useState<Range>("3m");
  const dark = theme === "dark";

  const activeStocks = stocks.filter((s) =>
    (s.purchases ?? []).some((p) => p.shares > 0)
  );

  if (activeStocks.length === 0) return null;

  const dateSet = new Set<string>();
  for (const s of activeStocks) {
    for (const d of s.data) dateSet.add(d.date);
  }
  const allDates = Array.from(dateSet).sort();

  const fullSeries = allDates.map((date) => {
    let total = 0;
    for (const s of activeStocks) {
      const shares = sharesOnDate(s.purchases ?? [], date);
      if (shares <= 0) continue;
      const point = s.data.find((d) => d.date === date);
      if (!point) continue;
      const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
      total += shares * point.close * (exchangeRate / tickerRate);
    }
    return { date, value: total };
  }).filter((d) => d.value > 0);

  const cutoff = (() => {
    const d = new Date();
    if (range === "3m") d.setMonth(d.getMonth() - 3);
    else d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  })();

  const series = fullSeries.filter((d) => d.date >= cutoff);
  if (series.length < 2) return null;

  const first = series[0].value;
  const last = series[series.length - 1].value;
  const change = last - first;
  const changePct = first > 0 ? (change / first) * 100 : 0;
  const positive = change >= 0;
  const color = positive ? "#16a34a" : "#ef4444";

  const axisColor = dark ? "#6b7280" : "#9ca3af";
  const gridColor = dark ? "#1f2937" : "#f3f4f6";
  const bgColor = dark ? "#111827" : "#ffffff";
  const tickInterval = Math.max(1, Math.floor(series.length / 6));

  function fmtDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Portfolio value</span>
          <span className={`ml-3 text-sm font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
            {positive ? "+" : ""}{formatCurrency(change, currency, 0)} ({positive ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
        </div>
        <div className="flex gap-1">
          {(["3m", "1y"] as Range[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                range === r
                  ? "bg-indigo-500 text-white"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              {r === "3m" ? "3M" : "1Y"}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={series} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            interval={tickInterval}
            tick={{ fill: axisColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v, currency, 0)}
            tick={{ fill: axisColor, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={88}
          />
          <Tooltip
            contentStyle={{ background: bgColor, border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
            labelFormatter={fmtDate}
            formatter={(v: number) => [formatCurrency(v, currency, 0), "Value"]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill="url(#portfolioGradient)"
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
