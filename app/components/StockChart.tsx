"use client";

import { useState, useRef } from "react";
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
  portfolioPct?: number;
}

function formatEarningsDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function StockChart({ symbol, name, earningsDate, data, onRemove, color, shares, onSharesChange, dragHandleProps, theme = "dark", portfolioPct }: Props) {
  const [holdings, setHoldings] = useState<{ name: string; pct: number }[] | null>(null);
  const [showHoldings, setShowHoldings] = useState(false);
  const [showGains, setShowGains] = useState(false);
  const fetchedRef = useRef(false);

  async function handleNameEnter() {
    if (holdings !== null && holdings.length === 0) return; // known empty — skip
    setShowHoldings(true);
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    try {
      const res = await fetch(`/api/holdings?symbol=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name)}`);
      const json = await res.json();
      const fetched: { name: string; pct: number }[] = json.holdings ?? [];
      setHoldings(fetched);
      if (fetched.length === 0) setShowHoldings(false);
    } catch {
      setHoldings([]);
      setShowHoldings(false);
    }
  }

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
  const absChange = last - first;
  const positionGain = shares && shares > 0 ? shares * absChange : null;

  const gainColor = positive ? "#16a34a" : "#ef4444";
  const overlayBg = dark ? "#111827" : "#ffffff";

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 min-w-0 border border-gray-200 shadow-sm relative">
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
            <span
              className="text-gray-900 font-bold text-sm truncate cursor-default"
              title={name}
              onMouseEnter={handleNameEnter}
              onMouseLeave={() => setShowHoldings(false)}
            >
              {name}
            </span>
            <WolfHover isPositive={positive}>
              <TrumpHover isNegative={!positive}>
                <span
                  className="text-sm font-medium shrink-0 cursor-default"
                  style={{ color: gainColor }}
                  onMouseEnter={() => setShowGains(true)}
                  onMouseLeave={() => setShowGains(false)}
                >
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
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="text-2xl font-bold tracking-tight" style={{ color: gainColor }}>
          {fmt(last)}
        </div>
        <div className="text-sm font-medium" style={{ color: gainColor }}>
          {positive ? "+" : ""}{fmt(absChange)}
        </div>
        {positionValue !== null && (
          <div className="text-gray-700 text-lg font-semibold tracking-tight">
            {fmt(positionValue)}
            {portfolioPct !== undefined && (
              <span className="text-gray-400 text-xs font-normal ml-1.5">{portfolioPct.toFixed(1)}% of portfolio</span>
            )}
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

      {/* Gains tooltip — appears over chart when hovering the % badge */}
      {showGains && (
        <div
          className="absolute right-4 z-30 rounded-lg p-3 shadow-lg min-w-[200px]"
          style={{ top: "4rem", background: tooltipBg, border: `1px solid ${dark ? "#374151" : "#e5e7eb"}` }}
          onMouseEnter={() => setShowGains(true)}
          onMouseLeave={() => setShowGains(false)}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>3-month performance</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>Period</span>
              <span style={{ color: dark ? "#d1d5db" : "#374151" }}>{fmtDate(data[0]?.date)} → {fmtDate(data[data.length - 1]?.date)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>Start</span>
              <span style={{ color: dark ? "#d1d5db" : "#374151" }}>{fmt(first)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className={dark ? "text-gray-500" : "text-gray-400"}>Current</span>
              <span style={{ color: gainColor }}>{fmt(last)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className={dark ? "text-gray-500" : "text-gray-400"}>Change</span>
              <span style={{ color: gainColor }}>
                {positive ? "+" : ""}{fmt(absChange)} ({positive ? "+" : ""}{change.toFixed(2)}%)
              </span>
            </div>
            {positionGain !== null && (
              <div
                className="flex justify-between gap-4 text-xs mt-1 pt-1.5 border-t"
                style={{ borderColor: dark ? "#374151" : "#e5e7eb" }}
              >
                <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>Position gain</span>
                <span style={{ color: positionGain >= 0 ? "#16a34a" : "#ef4444" }}>
                  {positionGain >= 0 ? "+" : ""}{fmt(positionGain)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Holdings overlay — covers entire card */}
      {showHoldings && (
        <div
          className="absolute inset-0 rounded-xl z-20 flex flex-col p-4"
          style={{ background: overlayBg, border: `1px solid ${dark ? "#374151" : "#e5e7eb"}` }}
          onMouseEnter={() => setShowHoldings(true)}
          onMouseLeave={() => setShowHoldings(false)}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>Top holdings</p>
          {holdings === null ? (
            <p className="text-xs" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>Loading…</p>
          ) : holdings.length === 0 ? (
            <p className="text-xs" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>No holdings data available</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {holdings.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0"
                  style={{ borderColor: dark ? "#1f2937" : "#f3f4f6" }}>
                  <span className="text-sm truncate pr-3" style={{ color: dark ? "#f9fafb" : "#111827" }}>{h.name}</span>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: dark ? "#d1d5db" : "#374151" }}>{(h.pct * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
