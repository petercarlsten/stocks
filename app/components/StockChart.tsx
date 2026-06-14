"use client";

import TrumpHover from "./TrumpHover";
import WolfHover from "./WolfHover";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

interface DataPoint {
  date: string;
  close: number;
}

interface Props {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: DataPoint[];
  onRemove: () => void;
  color: string;
  shares?: number;
  onSharesChange: (shares: number | undefined) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  theme?: "light" | "dark";
}

function formatEarningsDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function StockChart({ symbol, name, earningsDate, data, onRemove, color, shares, onSharesChange, dragHandleProps, theme = "dark" }: Props) {
  const dark = theme === "dark";
  const chartGrid   = dark ? "#374151" : "#e5e7eb";
  const chartTick   = dark ? "#9ca3af" : "#9ca3af";
  const tooltipBg   = dark ? "#1f2937" : "#ffffff";
  const tooltipBdr  = dark ? "none"    : "1px solid #e5e7eb";
  const tooltipTxt  = dark ? "#d1d5db" : "#374151";

  function fmt(value: number): string {
    return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const first = data[0]?.close ?? 0;
  const last = data[data.length - 1]?.close ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;
  const positive = change >= 0;

  const min = Math.min(...data.map((d) => d.close));
  const max = Math.max(...data.map((d) => d.close));
  const padding = (max - min) * 0.1 || 1;

  const earningsInRange = earningsDate
    ? data.some((d) => d.date === earningsDate) ||
      (data.length > 0 && earningsDate >= data[0].date && earningsDate <= data[data.length - 1].date)
    : false;

  const today = new Date().toISOString().split("T")[0];
  const earningsIsFuture = earningsDate ? earningsDate > today : false;

  const positionValue = shares && shares > 0 ? shares * last : null;

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 min-w-0 border border-gray-200 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mt-1 shrink-0 select-none"
            title="Drag to reorder"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <circle cx="4" cy="3" r="1.2"/><circle cx="10" cy="3" r="1.2"/>
              <circle cx="4" cy="7" r="1.2"/><circle cx="10" cy="7" r="1.2"/>
              <circle cx="4" cy="11" r="1.2"/><circle cx="10" cy="11" r="1.2"/>
            </svg>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-gray-900 font-bold text-sm truncate" title={name}>{name}</span>
            <WolfHover isPositive={positive}>
              <TrumpHover isNegative={!positive}>
                <span className={`text-sm font-medium shrink-0 ${positive ? "text-green-600" : "text-red-500"}`}>
                  {positive ? "+" : ""}{change.toFixed(2)}%
                </span>
              </TrumpHover>
            </WolfHover>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{symbol}</span>
            {earningsDate && (
              <span className="text-xs text-amber-600">
                {earningsIsFuture ? "Next earnings call " : "Reported "}
                {formatEarningsDate(earningsDate)}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-gray-500 text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>
      <div className="flex items-baseline gap-3">
        <div className={`text-2xl font-bold tracking-tight ${positive ? "text-green-600" : "text-red-500"}`}>
          {fmt(last)}
        </div>
        {positionValue !== null && (
          <div className="text-gray-700 text-lg font-semibold tracking-tight">
            {fmt(positionValue)}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis
            dataKey="date"
            tick={{ fill: chartTick, fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min - padding, max + padding]}
            tick={{ fill: chartTick, fontSize: 10 }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: tooltipBdr, borderRadius: 8 }}
            labelStyle={{ color: tooltipTxt }}
            itemStyle={{ color }}
            formatter={(v) => [`$${Number(v).toFixed(2)}`, "Close"]}
          />
          {earningsInRange && earningsDate && (
            <ReferenceLine
              x={earningsDate}
              stroke="#d97706"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: "E", position: "top", fill: "#d97706", fontSize: 10 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        <label className="text-gray-400 text-xs shrink-0">Shares owned</label>
        <input
          type="number"
          min="0"
          step="any"
          value={shares ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            onSharesChange(v === "" ? undefined : Math.max(0, parseFloat(v)));
          }}
          className="w-24 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
        />
      </div>
    </div>
  );
}
