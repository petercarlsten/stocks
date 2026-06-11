"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import SortableStockChart from "./components/SortableStockChart";
import TopGainers from "./components/TopGainers";
import DashboardLeaderboard from "./components/DashboardLeaderboard";
import WolfAnimation from "./components/WolfAnimation";

interface StockData {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: { date: string; close: number }[];
  shares?: number;
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];
const MAX_STOCKS = 6;
const LEGACY_KEY = "saved-stocks-v2";

function cacheKey(username: string) {
  return `stocks-cache-${username}`;
}

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
  const { data: session, status } = useSession();
  const username = session?.user?.name ?? null;

  const [stocks, setStocks] = useState<StockData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const initializedFor = useRef<string | null>(null);

  // Load stocks from server (with per-user localStorage cache for instant render)
  useEffect(() => {
    if (!username || initializedFor.current === username) return;
    initializedFor.current = username;

    // Show cached data instantly while server loads
    const cached: StockData[] = JSON.parse(localStorage.getItem(cacheKey(username)) ?? "[]");
    if (cached.length > 0) setStocks(cached);

    fetch("/api/user/stocks")
      .then((r) => r.json())
      .then(async (serverStocks: StockData[]) => {
        if (serverStocks.length > 0) {
          // Server has data — use it and refresh prices
          const refreshed = await Promise.all(
            serverStocks.map((s) =>
              refreshStockData(s.symbol)
                .then(({ data, earningsDate }) => ({ ...s, data, earningsDate }))
                .catch(() => s)
            )
          );
          setStocks(refreshed);
          setLastRefreshed(new Date());
        } else {
          // Server is empty — migrate legacy localStorage data if any
          const legacy: StockData[] = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
          if (legacy.length > 0) {
            await fetch("/api/user/stocks", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(legacy),
            });
            setStocks(legacy);
            localStorage.removeItem(LEGACY_KEY);
          }
        }
      })
      .catch(() => {});
  }, [username]);

  // Persist to server + cache on any stocks change (skip initial empty state)
  const saveRef = useRef(false);
  useEffect(() => {
    if (!username) return;
    if (!saveRef.current) { saveRef.current = true; return; } // skip mount
    localStorage.setItem(cacheKey(username), JSON.stringify(stocks));
    fetch("/api/user/stocks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stocks),
    }).catch(() => {});
  }, [stocks, username]);

  // Auto-refresh prices every hour
  useEffect(() => {
    const id = setInterval(() => {
      setStocks((current) => {
        if (current.length === 0) return current;
        Promise.all(
          current.map((s) =>
            refreshStockData(s.symbol).then(({ data, earningsDate }) => ({ ...s, data, earningsDate }))
          )
        )
          .then((results) => { setStocks(results); setLastRefreshed(new Date()); })
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

  const updateShares = useCallback((symbol: string, shares: number | undefined) => {
    setStocks((prev) => prev.map((s) => s.symbol === symbol ? { ...s, shares } : s));
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setStocks((prev) => {
      const oldIndex = prev.findIndex((s) => s.symbol === active.id);
      const newIndex = prev.findIndex((s) => s.symbol === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const cols = stocks.length <= 2 ? stocks.length || 1 : Math.min(stocks.length, 3);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-600 text-sm">Loading…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-screen-xl mx-auto">
        <div className="flex items-start gap-6 mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polyline points="2,26 10,20 18,22 28,10 38,7 46,3" stroke="url(#sparkGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <polygon points="2,26 10,20 18,22 28,10 38,7 46,3 46,32 2,32" fill="url(#areaGrad)" opacity="0.3"/>
                <circle cx="46" cy="3" r="3" fill="#10B981"/>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="48" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#6366F1"/>
                    <stop offset="100%" stopColor="#10B981"/>
                  </linearGradient>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#10B981"/>
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                  </linearGradient>
                </defs>
              </svg>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 bg-clip-text text-transparent">
                Stock Charts
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-gray-500 text-sm">
                Last 3 months · up to 6 stocks · auto-refresh every 1h
              </p>
              {username && (
                <span className="text-gray-600 text-xs">· {username}</span>
              )}
            </div>
            {lastRefreshed && (
              <p className="text-gray-600 text-xs mt-0.5">
                Last updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            <WolfAnimation />
          </div>
          <DashboardLeaderboard stocks={stocks} />
          <TopGainers />
          <div className="shrink-0 pt-1">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-lg px-3 py-2 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>

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

        {(() => {
          const total = stocks.reduce((sum, s) => {
            const price = s.data[s.data.length - 1]?.close ?? 0;
            return sum + (s.shares && s.shares > 0 ? s.shares * price : 0);
          }, 0);
          return total > 0 ? (
            <div className="flex items-center gap-3 mb-4 bg-gray-900 rounded-xl px-4 py-3">
              <span className="text-gray-400 text-sm">Portfolio value</span>
              <span className="text-white text-xl font-bold tracking-tight">
                {total.toLocaleString("en-US", { style: "currency", currency: "USD" })}
              </span>
            </div>
          ) : null;
        })()}

        {stocks.length === 0 ? (
          <p className="text-gray-600 text-center mt-24">
            Add a stock ticker above to get started.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stocks.map((s) => s.symbol)} strategy={rectSortingStrategy}>
              <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              >
                {stocks.map((s, i) => (
                  <SortableStockChart
                    key={s.symbol}
                    symbol={s.symbol}
                    name={s.name}
                    earningsDate={s.earningsDate}
                    data={s.data}
                    color={COLORS[i % COLORS.length]}
                    shares={s.shares}
                    onRemove={() => removeStock(s.symbol)}
                    onSharesChange={(shares) => updateShares(s.symbol, shares)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </main>
  );
}
