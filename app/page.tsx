"use client";

import { useState, useCallback, useEffect } from "react";
import StockChart from "./components/StockChart";

interface StockData {
  symbol: string;
  name: string;
  data: { date: string; close: number }[];
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];
const MAX_STOCKS = 6;
const STORAGE_KEY = "saved-stocks";

async function fetchStock(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { symbol: json.symbol, name: json.name, data: json.data };
}

export default function Home() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Restore saved tickers on mount
  useEffect(() => {
    const saved: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (saved.length === 0) return;
    setLoading(true);
    Promise.all(saved.map(fetchStock))
      .then((results) => setStocks(results))
      .catch(() => {/* ignore partial failures on restore */})
      .finally(() => setLoading(false));
  }, []);

  // Persist ticker list whenever stocks change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stocks.map((s) => s.symbol)));
  }, [stocks]);

  // Auto-refresh all stocks every hour
  useEffect(() => {
    const id = setInterval(() => {
      setStocks((current) => {
        if (current.length === 0) return current;
        Promise.all(current.map((s) => fetchStock(s.symbol)))
          .then((results) => setStocks(results))
          .catch(() => {/* keep stale data on failure */});
        return current;
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const addStock = useCallback(async () => {
    const symbol = input.trim().toUpperCase();
    if (!symbol) return;
    if (stocks.length >= MAX_STOCKS) {
      setError("Maximum 6 stocks reached.");
      return;
    }
    if (stocks.find((s) => s.symbol === symbol)) {
      setError(`${symbol} is already added.`);
      return;
    }

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
        <p className="text-gray-400 mb-6 text-sm">Last 3 months · up to 6 stocks</p>

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
