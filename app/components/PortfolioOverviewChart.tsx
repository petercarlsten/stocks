"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatCurrency } from "../lib/formatCurrency";

interface Purchase {
  shares: number;
  price?: number;
  date?: string;
}

interface Stock {
  symbol: string;
  data?: { date: string; close: number }[];
  purchases?: Purchase[];
  currency?: string;
}

interface Props {
  stocks: Stock[];
  usdRates: Record<string, number>;
  exchangeRate: number;
  currency: string;
  theme?: "light" | "dark";
}

function fmtAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function PortfolioOverviewChart({ stocks, usdRates, exchangeRate, currency, theme = "light" }: Props) {
  const { chartData, startTotal } = useMemo(() => {
    // Only stocks that have purchases and price data
    const active = stocks.filter(s =>
      (s.purchases ?? []).some(p => p.shares > 0) &&
      (s.data ?? []).length > 0
    );
    if (active.length === 0) return { chartData: [], startTotal: 0 };

    const now = new Date();
    const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const cutoffStr = cutoff.toLocaleDateString("sv");

    // Union of all trading dates in the last 12 months
    const dateSet = new Set<string>();
    for (const s of active) {
      for (const d of (s.data ?? [])) {
        if (d.date >= cutoffStr) dateSet.add(d.date);
      }
    }
    const dates = [...dateSet].sort();
    if (dates.length < 5) return { chartData: [], startTotal: 0 };

    const rawPoints = dates.map(date => {
      let total = 0;
      for (const s of active) {
        // How many shares were held on this date (respects purchase dates)
        const sharesOnDate = (s.purchases ?? []).reduce((sum, p) => {
          if (p.shares <= 0) return sum;
          // Include if no purchase date, or purchase date is on/before this date
          return (!p.date || p.date <= date) ? sum + p.shares : sum;
        }, 0);
        if (sharesOnDate <= 0) continue;

        // Most recent close on or before this date (forward-fill only)
        const data = s.data ?? [];
        let price = 0;
        for (let j = data.length - 1; j >= 0; j--) {
          if (data[j].date <= date) { price = data[j].close; break; }
        }
        if (price === 0) continue;

        const fx = exchangeRate / (usdRates[s.currency ?? "USD"] ?? 1);
        total += sharesOnDate * price * fx;
      }
      return { date, total };
    });

    // Drop leading zeros (before any stock was purchased)
    const firstNonZero = rawPoints.findIndex(p => p.total > 0);
    if (firstNonZero < 0) return { chartData: [], startTotal: 0 };
    const trimmed = rawPoints.slice(firstNonZero);
    if (trimmed.length < 5) return { chartData: [], startTotal: 0 };

    return { chartData: trimmed, startTotal: trimmed[0].total };
  }, [stocks, usdRates, exchangeRate]);

  if (chartData.length < 5) return null;

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const changeAbs = last.total - first.total;
  const changePct = first.total > 0 ? (changeAbs / first.total) * 100 : 0;
  const isPositive = changeAbs >= 0;

  const color = isPositive ? "#10B981" : "#EF4444";
  const axisColor = theme === "dark" ? "#6B7280" : "#9CA3AF";
  const refColor = theme === "dark" ? "#374151" : "#E5E7EB";
  const bgClass = theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100";
  const textClass = theme === "dark" ? "text-gray-300" : "text-gray-500";

  return (
    <div className={`rounded-xl border ${bgClass} px-4 pt-3 pb-1 mb-4`}>
      <div className="flex items-baseline gap-3 mb-1">
        <span className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}>
          1-year portfolio
        </span>
        <span className={`text-sm font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
          {changeAbs >= 0 ? "+" : ""}{formatCurrency(changeAbs, currency, 0)}
          <span className="text-xs font-normal ml-1 opacity-80">
            ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
          </span>
        </span>
        <span className={`text-xs ml-auto ${textClass}`}>
          {fmtAxisDate(first.date)} – {fmtAxisDate(last.date)}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={fmtAxisDate}
            tick={{ fontSize: 10, fill: axisColor }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={60}
          />
          <YAxis hide domain={["auto", "auto"]} />
          <ReferenceLine y={startTotal} stroke={refColor} strokeWidth={1} strokeDasharray="3 3" />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { date: string; total: number };
              const delta = d.total - startTotal;
              return (
                <div className={`rounded-lg px-2 py-1 text-xs shadow ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800 border border-gray-200"}`}>
                  <div className="font-medium">{fmtAxisDate(d.date)}</div>
                  <div className={textClass}>{formatCurrency(d.total, currency, 0)}</div>
                  <div className={delta >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {delta >= 0 ? "+" : ""}{formatCurrency(delta, currency, 0)}
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={color}
            strokeWidth={1.5}
            fill="url(#portfolioFill)"
            dot={false}
            activeDot={{ r: 3, fill: color, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
