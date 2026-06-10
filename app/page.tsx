"use client";

import { useState, useCallback, useEffect } from "react";
import StockChart from "./components/StockChart";

interface StockData {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: { date: string; close: number }[];
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];
const MAX_STOCKS = 6;
const STORAGE_KEY = "saved-stocks-v2";

async function fetchStock(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { symbol: json.symbol, name: json.name, earningsDate: json.earningsDate ?? null, data: json.data };
}

async function refreshStockData(symbol: string) {
  const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}&noName=1`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { data: json.data as StockData["data"], earningsDate: (json.earningsDate as string | null) ?? null };
}

export default function Home() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore cached stock data immediately, then refresh in background
  useEffect(() => {
    const cached: StockData[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (cached.length === 0) return;
    setStocks(cached); // show cached charts instantly
    // Refresh data silently in the background
    Promise.all(
      cached.map((s) =>
        refreshStockData(s.symbol).then(({ data, earningsDate }) => ({ ...s, data, earningsDate }))
      )
    )
      .then(setStocks)
      .catch(() => {}); // keep cached data on failure
  }, []);

  // Persist full stock data (symbol + name + chart data)
  useEffect(() => {
    if (stocks.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks));
    }
  }, [stocks]);

  // Auto-refresh all stocks every hour
  useEffect(() => {
    const id = setInterval(() => {
      setStocks((current) => {
        if (current.length === 0) return current;
        Promise.all(
          current.map((s) =>
            refreshStockData(s.symbol).then(({ data, earningsDate }) => ({ ...s, data, earningsDate }))
          )
        )
          .then(setStocks)
          .catch(() => {});
        return current;
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const addStock = useCallback(async () => {
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    if (stocks.length >= MAX_STOCKS) { setError("Maximum 6 stocks reached."); return; }
    if (stocks.find((s) => s.symbol === symbol)) { setError(`${symbol} is already added.`); return; }

    setLoading(true);
    setError("");
    try {
      const stock = await fetchStock(symbol);
      setStocks((prev) => [...prev, stock]);
      setInput("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [input, stocks]);

  const removeStock = useCallback((symbol: string) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }, []);

  const cols = stocks.length <= 2 ? stocks.length || 1 : Math.min(stocks.length, 3);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-screen-xl mx-auto">
        <h1 className="text-3xl font-bold mb-1">Stock Charts</h1>
        <p className="text-gray-400 mb-6 text-sm">Last 3 months · up to 6 stocks · auto-refresh every 1h</p>

        <div className="flex gap-2 mb-4">
          <input
            className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48"
            placeholder="Ticker (e.g. AAPL)"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && addStock()}
            disabled={loading}
          />
          <button
            onClick={addStock}
            disabled={loading || !input.trim() || stocks.length >= MAX_STOCKS}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg px-5 py-2 font-medium transition-colors"
          >
            {loading ? "Loading…" : "Add"}
          </button>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {stocks.length === 0 ? (
          <p className="text-gray-600 text-center mt-24">
            Add a stock ticker above to get started.
          </p>
        ) : (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {stocks.map((s, i) => (
              <StockChart
                key={s.symbol}
                symbol={s.symbol}
                name={s.name}
                earningsDate={s.earningsDate}
                data={s.data}
                color={COLORS[i % COLORS.length]}
                onRemove={() => removeStock(s.symbol)}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
