"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import TrumpHover from "./TrumpHover";
import WolfHover from "./WolfHover";
import { ALL_CURRENCIES } from "./SettingsPanel";
import { formatCurrency } from "../lib/formatCurrency";
import { useTranslation } from "./SettingsContext";
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

export interface Purchase {
  date?: string;
  shares: number;
  price?: number;
}

interface Props {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: DataPoint[];
  onRemove: () => void;
  color: string;
  purchases?: Purchase[];
  onPurchasesChange: (updater: Purchase[] | ((prev: Purchase[]) => Purchase[])) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  theme?: "light" | "dark";
  portfolioPct?: number;
  tickerCurrency?: string;
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

export default function StockChart({ symbol, name, earningsDate, data, onRemove, color, purchases, onPurchasesChange, dragHandleProps, theme = "dark", portfolioPct, tickerCurrency = "USD" }: Props) {
  const t = useTranslation();
  const [holdings, setHoldings] = useState<{ name: string; pct: number }[] | null>(null);
  const [showHoldings, setShowHoldings] = useState(false);
  const [showGains, setShowGains] = useState(false);
  const fetchedRef = useRef(false);
  const holdingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cardCurrency, setCardCurrency] = useState(tickerCurrency);
  const [cardExRate, setCardExRate] = useState(1);
  const [currencyQuery, setCurrencyQuery] = useState("");
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const usdRatesRef = useRef<Record<string, number>>({ USD: 1 });
  const fetchingRef = useRef(new Set<string>());
  const failedRef = useRef(new Set<string>());

  const filteredCurrencies = useMemo(() => {
    const q = currencyQuery.toLowerCase().trim();
    if (!q) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [currencyQuery]);

  const applyRate = useCallback((display: string, ticker: string, rates: Record<string, number>) => {
    if (display === ticker) { setCardExRate(1); return; }
    setCardExRate((rates[display] ?? 1) / (rates[ticker] ?? 1));
  }, []);

  function selectCurrency(code: string) {
    setCardCurrency(code);
    setCurrencyQuery("");
    setCurrencyOpen(false);
  }

  useEffect(() => {
    if (Object.keys(usdRatesRef.current).length > 1) {
      applyRate(cardCurrency, tickerCurrency, usdRatesRef.current);
      return;
    }
    fetch("https://open.er-api.com/v6/latest/USD")
      .then((r) => r.json())
      .then((d) => {
        usdRatesRef.current = { USD: 1, ...d.rates };
        applyRate(cardCurrency, tickerCurrency, usdRatesRef.current);
      })
      .catch(() => setCardExRate(1));
  }, [cardCurrency, tickerCurrency, applyRate]);

  // Fetch historical prices for purchases that have a date but no price yet.
  // Uses functional updaters so concurrent fetches don't overwrite each other.
  useEffect(() => {
    (purchases ?? []).forEach((p, i) => {
      if (!p.date || p.price != null) return;
      const key = `${i}:${p.date}`;
      if (fetchingRef.current.has(key) || failedRef.current.has(key)) return;
      fetchingRef.current.add(key);

      if (data.length > 0 && p.date >= data[0].date && p.date <= data[data.length - 1].date) {
        const pt = data.find((d) => d.date >= p.date!) ?? data[0];
        onPurchasesChange((prev) => prev.map((pp, j) => j === i ? { ...pp, price: pt.close } : pp));
        fetchingRef.current.delete(key);
        return;
      }

      fetch(`/api/price?symbol=${encodeURIComponent(symbol)}&date=${p.date}`)
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then((d) => {
          onPurchasesChange((prev) => prev.map((pp, j) => j === i && pp.price == null ? { ...pp, price: d.price } : pp));
        })
        .catch(() => { failedRef.current.add(key); })
        .finally(() => fetchingRef.current.delete(key));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchases, data, symbol]);

  async function handleNameEnter() {
    if (holdings !== null && holdings.length === 0) return; // known empty — skip
    holdingsTimerRef.current = setTimeout(async () => {
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
    }, 1000);
  }

  const dark = theme === "dark";
  const chartGrid   = dark ? "#374151" : "#e5e7eb";
  const chartTick   = dark ? "#9ca3af" : "#9ca3af";
  const tooltipBg   = dark ? "#1f2937" : "#ffffff";
  const tooltipBdr  = dark ? "none"    : "1px solid #e5e7eb";
  const tooltipTxt  = dark ? "#d1d5db" : "#374151";

  function fmt(value: number): string {
    return formatCurrency(value * cardExRate, cardCurrency);
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

  const totalShares = (purchases ?? []).reduce((sum, p) => sum + (p.shares || 0), 0);

  const purchaseDatesOnChart = useMemo(() => {
    if (!purchases || data.length === 0) return [];
    const multi = purchases.filter(p => p.date).length > 1;
    return purchases
      .map((p, i) => {
        if (!p.date || p.date < data[0].date || p.date > data[data.length - 1].date) return null;
        const chartDate = (data.find((d) => d.date >= p.date!) ?? data[0])?.date;
        return { chartDate, label: multi ? `B${i + 1}` : "B" };
      })
      .filter(Boolean) as { chartDate: string; label: string }[];
  }, [purchases, data]);

  const positionValue = totalShares > 0 ? totalShares * last : null;
  const absChange = last - first;
  const positionGain = totalShares > 0 ? totalShares * absChange : null;

  const gainColor = positive ? "#16a34a" : "#ef4444";
  const overlayBg = dark ? "#111827" : "#ffffff";

  return (
    <div className="bg-white rounded-xl p-4 flex flex-col gap-2 min-w-0 border border-gray-200 shadow-sm relative">
      <div className="flex items-start justify-between gap-2">
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing mt-1 shrink-0 select-none"
            title={t.dragToReorder}
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
            <span
              className="text-gray-900 font-bold text-sm truncate cursor-default"
              title={name}
              onMouseEnter={handleNameEnter}
              onMouseLeave={() => { if (holdingsTimerRef.current) clearTimeout(holdingsTimerRef.current); setShowHoldings(false); }}
            >
              {name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-xs">{symbol}</span>
            {earningsDate && (
              <span className="text-xs text-amber-600">
                {earningsIsFuture ? t.nextEarningsCall : t.reported}
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
              <span className="text-gray-400 text-xs font-normal ml-1.5">{portfolioPct.toFixed(1)}{t.ofPortfolio}</span>
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
            tickFormatter={(v) => formatCurrency(v * cardExRate, cardCurrency, 0)}
            width={56}
          />
          <Tooltip
            contentStyle={{ background: tooltipBg, border: tooltipBdr, borderRadius: 8 }}
            labelStyle={{ color: tooltipTxt }}
            itemStyle={{ color }}
            formatter={(v) => [formatCurrency(Number(v) * cardExRate, cardCurrency), t.close]}
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
          {purchaseDatesOnChart.map((p, i) => (
            <ReferenceLine
              key={i}
              x={p.chartDate}
              stroke="#6366f1"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{ value: p.label, position: "top", fill: "#6366f1", fontSize: 10 }}
            />
          ))}
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-1">
        {(purchases ?? []).length > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-4 border-t-2 border-dashed border-indigo-400"></span>
            {t.purchaseDate}
          </span>
        )}
        {earningsDate && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="inline-block w-4 border-t-2 border-dashed border-amber-400"></span>
            {t.earningsCallDate}
          </span>
        )}
      </div>
      <div className="pt-2 border-t border-gray-100">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">{t.purchases}</span>
            {totalShares > 0 && (
              <span className="text-gray-500 text-xs">· {t.sharesTotal(totalShares)}</span>
            )}
          </div>
          <div className="relative">
          <input
            type="text"
            value={currencyQuery}
            placeholder={cardCurrency}
            onChange={(e) => { setCurrencyQuery(e.target.value); setCurrencyOpen(true); }}
            onFocus={() => setCurrencyOpen(true)}
            onBlur={() => setTimeout(() => setCurrencyOpen(false), 150)}
            className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
          />
          {currencyOpen && (
            <ul className="absolute bottom-full mb-1 right-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {filteredCurrencies.length === 0 ? (
                <li className="px-3 py-2 text-gray-400 text-xs">{t.noResults}</li>
              ) : (
                filteredCurrencies.map((c) => (
                  <li
                    key={c.code}
                    onMouseDown={() => selectCurrency(c.code)}
                    className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs hover:bg-gray-50 ${c.code === cardCurrency ? "text-indigo-600 font-semibold" : "text-gray-900"}`}
                  >
                    <span className="shrink-0 w-8 font-mono">{c.code}</span>
                    <span className="text-gray-500 truncate">{c.name}</span>
                  </li>
                ))
              )}
            </ul>
          )}
          </div>
        </div>
        {(purchases ?? []).map((p, i) => (
          <div key={i} className="flex items-center gap-2 mb-1">
            <input
              type="date"
              value={p.date ?? ""}
              max={today}
              onChange={(e) => {
                const oldKey = `${i}:${p.date ?? ""}`;
                failedRef.current.delete(oldKey);
                fetchingRef.current.delete(oldKey);
                onPurchasesChange((purchases ?? []).map((pp, j) => j === i ? { ...pp, date: e.target.value || undefined, price: undefined } : pp));
              }}
              className="w-32 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={p.shares || ""}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onPurchasesChange((purchases ?? []).map((pp, j) => j === i ? { ...pp, shares: isNaN(v) ? 0 : Math.max(0, v) } : pp));
              }}
              className="w-20 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-900 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder={t.shares}
            />
            <button
              onClick={() => {
                const key = `${i}:${p.date ?? ""}`;
                failedRef.current.delete(key);
                fetchingRef.current.delete(key);
                onPurchasesChange((purchases ?? []).filter((_, j) => j !== i));
              }}
              className="text-gray-300 hover:text-red-400 text-base leading-none shrink-0"
              title={t.remove}
            >×</button>
          </div>
        ))}
        <button
          onClick={() => onPurchasesChange([...(purchases ?? []), { date: today, shares: 0 }])}
          className="text-indigo-500 hover:text-indigo-700 text-xs mt-0.5"
        >{t.addPurchase}</button>
      </div>

      {/* Gains tooltip — appears over chart when hovering the % badge */}
      {showGains && (
        <div
          className="absolute right-4 z-30 rounded-lg p-3 shadow-lg min-w-[200px]"
          style={{ top: "4rem", background: tooltipBg, border: `1px solid ${dark ? "#374151" : "#e5e7eb"}` }}
          onMouseEnter={() => setShowGains(true)}
          onMouseLeave={() => setShowGains(false)}
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.threeMonthPerformance}</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.period}</span>
              <span style={{ color: dark ? "#d1d5db" : "#374151" }}>{fmtDate(data[0]?.date)} → {fmtDate(data[data.length - 1]?.date)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.start}</span>
              <span style={{ color: dark ? "#d1d5db" : "#374151" }}>{fmt(first)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className={dark ? "text-gray-500" : "text-gray-400"}>{t.current}</span>
              <span style={{ color: gainColor }}>{fmt(last)}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className={dark ? "text-gray-500" : "text-gray-400"}>{t.change}</span>
              <span style={{ color: gainColor }}>
                {positive ? "+" : ""}{fmt(absChange)} ({positive ? "+" : ""}{change.toFixed(2)}%)
              </span>
            </div>
            {positionGain !== null && (
              <div
                className="flex justify-between gap-4 text-xs mt-1 pt-1.5 border-t"
                style={{ borderColor: dark ? "#374151" : "#e5e7eb" }}
              >
                <span style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.positionGain}</span>
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
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.topHoldings}</p>
          {holdings === null ? (
            <p className="text-xs" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.loading}</p>
          ) : holdings.length === 0 ? (
            <p className="text-xs" style={{ color: dark ? "#6b7280" : "#9ca3af" }}>{t.noHoldingsData}</p>
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
