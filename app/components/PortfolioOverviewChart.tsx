"use client";

import { useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { formatCurrency } from "../lib/formatCurrency";

interface Stock {
  symbol: string;
  data?: { date: string; close: number }[];
  purchases?: { shares: number; date?: string; price?: number }[];
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
  const { chartData, isPositive, baseline } = useMemo(() => {
    const active = stocks.filter(s =>
      (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0) > 0 &&
      (s.data ?? []).length > 0
    );
    if (active.length === 0) return { chartData: [], isPositive: true, baseline: 0 };

    // Last 3 months
    const now = new Date();
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    const cutoffStr = cutoff.toLocaleDateString("sv");

    // Union of dates across all stocks within window
    const dateSet = new Set<string>();
    for (const s of active) {
      for (const d of (s.data ?? [])) {
        if (d.date >= cutoffStr) dateSet.add(d.date);
      }
    }
    const dates = [...dateSet].sort();
    if (dates.length < 3) return { chartData: [], isPositive: true, baseline: 0 };

    // Per-stock shares
    const shares = active.map(s =>
      (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0)
    );

    // For each chart date: find most recent close for each stock on or before that date
    const rawPoints = dates.map(date => {
      let total = 0;
      for (let i = 0; i < active.length; i++) {
        if (shares[i] <= 0) continue;
        const data = active[i].data ?? [];
        let price = 0;
        for (let j = data.length - 1; j >= 0; j--) {
          if (data[j].date <= date) { price = data[j].close; break; }
        }
        if (price === 0) continue;
        const tickerRate = usdRates[active[i].currency ?? "USD"] ?? 1;
        total += shares[i] * price * (exchangeRate / tickerRate);
      }
      return { date, total };
    }).filter(p => p.total > 0);

    if (rawPoints.length < 3) return { chartData: [], isPositive: true, baseline: 0 };

    const baseline = rawPoints[0].total;
    const last = rawPoints[rawPoints.length - 1].total;
    const isPositive = last >= baseline;

    const chartData = rawPoints.map(p => ({
      date: p.date,
      value: p.total - baseline,
      total: p.total,
    }));

    return { chartData, isPositive, baseline };
  }, [stocks, usdRates, exchangeRate]);

  if (chartData.length < 3) return null;

  const color = isPositive ? "#10B981" : "#EF4444";
  const colorDim = isPositive ? "#10B98122" : "#EF444422";
  const axisColor = theme === "dark" ? "#6B7280" : "#9CA3AF";
  const gridColor = theme === "dark" ? "#374151" : "#F3F4F6";
  const bgClass = theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-100";
  const textClass = theme === "dark" ? "text-gray-300" : "text-gray-500";

  const first = chartData[0];
  const last = chartData[chartData.length - 1];
  const changePct = baseline > 0 ? ((last.value) / baseline) * 100 : 0;
  const changeAbs = last.value;

  return (
    <div className={`rounded-xl border ${bgClass} px-4 pt-3 pb-1 mb-4`}>
      <div className="flex items-baseline gap-3 mb-1">
        <span className={`text-xs font-semibold uppercase tracking-wider ${textClass}`}>
          3-month portfolio
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
          <ReferenceLine y={0} stroke={gridColor} strokeWidth={1} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload as { date: string; value: number; total: number };
              return (
                <div className={`rounded-lg px-2 py-1 text-xs shadow ${theme === "dark" ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800 border border-gray-200"}`}>
                  <div className="font-medium">{fmtAxisDate(d.date)}</div>
                  <div className={d.value >= 0 ? "text-emerald-500" : "text-red-500"}>
                    {d.value >= 0 ? "+" : ""}{formatCurrency(d.value, currency, 0)}
                  </div>
                  <div className={textClass}>{formatCurrency(d.total, currency, 0)}</div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
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
