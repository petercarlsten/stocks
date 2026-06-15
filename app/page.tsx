"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import TrumpHover from "./components/TrumpHover";
import WolfHover from "./components/WolfHover";
import SettingsPanel from "./components/SettingsPanel";
import { SettingsContext } from "./components/SettingsContext";
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
import TickerSearch from "./components/TickerSearch";
import AllStocksNews from "./components/AllStocksNews";

interface Purchase {
  date?: string;
  shares: number;
  price?: number;
}

interface StockData {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: { date: string; close: number }[];
  currency?: string;
  purchases?: Purchase[];
}

// Migrate old single-purchase format to the purchases array
function migrateStock(s: StockData & { shares?: number; purchaseDate?: string; purchasePrice?: number }): StockData {
  if (s.purchases) return s;
  const { purchaseDate, purchasePrice, shares, ...rest } = s as typeof s;
  if (!purchaseDate && !shares) return { ...rest };
  return { ...rest, purchases: [{ date: purchaseDate, shares: shares ?? 0, price: purchasePrice }] };
}

const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6", "#F97316", "#A855F7", "#EAB308", "#06B6D4", "#84CC16"];

const MAX_STOCKS = 12;
const LEGACY_KEY = "saved-stocks-v2";

const SUFFIX_CURRENCY: Record<string, string> = {
  ".L": "GBP", ".DE": "EUR", ".MU": "EUR", ".HA": "EUR", ".HM": "EUR",
  ".SG": "EUR", ".F": "EUR", ".BE": "EUR", ".DU": "EUR", ".ST": "SEK",
  ".PA": "EUR", ".AS": "EUR", ".MI": "EUR", ".MC": "EUR", ".SW": "CHF",
  ".CO": "DKK", ".HE": "EUR", ".OL": "NOK", ".BR": "EUR", ".VI": "EUR",
  ".HK": "HKD", ".T": "JPY", ".AX": "AUD", ".SI": "SGD", ".KL": "MYR",
  ".NS": "INR",
};

function inferCurrency(symbol: string): string {
  const dotIdx = symbol.lastIndexOf(".");
  const suffix = dotIdx >= 0 ? symbol.slice(dotIdx) : "";
  return SUFFIX_CURRENCY[suffix] ?? "USD";
}

function cacheKey(username: string) {
  return `stocks-cache-${username}`;
}

async function fetchStock(symbol: string): Promise<StockData> {
  const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { symbol: json.symbol, name: json.name, earningsDate: json.earningsDate ?? null, data: json.data, currency: json.currency ?? inferCurrency(json.symbol) };
}

async function refreshStockData(symbol: string) {
  const res = await fetch(`/api/stocks?symbol=${encodeURIComponent(symbol)}&noName=1`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { data: json.data as StockData["data"], earningsDate: (json.earningsDate as string | null) ?? null, currency: (json.currency as string | undefined), symbol: (json.symbol as string | undefined) };
}

export default function Home() {
  const { data: session, status } = useSession();
  const username = session?.user?.name ?? null;

  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const initializedFor = useRef<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currency, setCurrency] = useState("USD");
  const [exchangeRate, setExchangeRate] = useState(1);
  const [usdRates, setUsdRates] = useState<Record<string, number>>({ USD: 1 });
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [trumpEnabled, setTrumpEnabled] = useState(true);
  const [wolfEnabled, setWolfEnabled] = useState(true);
  const [newsEnabled, setNewsEnabled] = useState(true);

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem("portfolio-currency");
    if (saved) setCurrency(saved);
    const savedTheme = localStorage.getItem("portfolio-theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    if (localStorage.getItem("portfolio-trump") === "false") setTrumpEnabled(false);
    if (localStorage.getItem("portfolio-wolf") === "false") setWolfEnabled(false);
    if (localStorage.getItem("portfolio-news") === "false") setNewsEnabled(false);
  }, []);

  // Apply dark class to <html> and persist
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("portfolio-theme", theme);
  }, [theme]);

  // Fetch exchange rates and persist whenever currency changes
  useEffect(() => {
    localStorage.setItem("portfolio-currency", currency);
    fetch(`https://open.er-api.com/v6/latest/USD`)
      .then((r) => r.json())
      .then((data) => {
        const rates: Record<string, number> = { USD: 1, ...data.rates };
        setUsdRates(rates);
        setExchangeRate(rates[currency] ?? 1);
      })
      .catch(() => { setExchangeRate(currency === "USD" ? 1 : 1); });
  }, [currency]);

  // Load stocks from server (with per-user localStorage cache for instant render)
  useEffect(() => {
    if (!username || initializedFor.current === username) return;
    initializedFor.current = username;

    // Show cached data instantly while server loads
    const cached: StockData[] = (JSON.parse(localStorage.getItem(cacheKey(username)) ?? "[]") as StockData[])
      .map((s) => migrateStock({ ...s, currency: s.currency ?? inferCurrency(s.symbol) }));
    if (cached.length > 0) setStocks(cached);

    fetch("/api/user/stocks")
      .then((r) => r.json())
      .then(async (serverStocks: StockData[]) => {
        if (serverStocks.length > 0) {
          // Server has data — use it and refresh prices
          const migrated = serverStocks.map((s) => migrateStock(s));
          const refreshed = await Promise.all(
            migrated.map((s) =>
              refreshStockData(s.symbol)
                .then(({ data, earningsDate, currency, symbol: corrected }) => ({ ...s, data, earningsDate, currency: currency ?? s.currency ?? inferCurrency(s.symbol), symbol: corrected ?? s.symbol }))
                .catch(() => ({ ...s, currency: s.currency ?? inferCurrency(s.symbol) }))
            )
          );
          // Preserve any in-memory purchase prices that haven't been saved to the server yet
          setStocks((prev) => refreshed.map((r) => {
            const cur = prev.find((p) => p.symbol === r.symbol);
            if (!cur?.purchases) return r;
            const merged = (r.purchases ?? cur.purchases).map((rp, i) => {
              const cp = cur.purchases?.[i];
              return cp?.price != null && rp.price == null ? { ...rp, price: cp.price } : rp;
            });
            return { ...r, purchases: merged };
          }));
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
            refreshStockData(s.symbol).then(({ data, earningsDate, currency, symbol: corrected }) => ({ ...s, data, earningsDate, currency: currency ?? s.currency ?? inferCurrency(s.symbol), symbol: corrected ?? s.symbol }))
          )
        )
          .then((results) => { setStocks(results); setLastRefreshed(new Date()); })
          .catch(() => {});
        return current;
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const addStockBySymbol = useCallback(async (symbol: string) => {
    if (stocks.length >= MAX_STOCKS) { setError("Maximum 9 stocks reached."); return; }
    if (stocks.find((s) => s.symbol === symbol)) { setError(`${symbol} is already added.`); return; }

    setLoading(true);
    setError("");
    try {
      const stock = await fetchStock(symbol);
      setStocks((prev) => [...prev, stock]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [stocks]);

  const removeStock = useCallback((symbol: string) => {
    setStocks((prev) => prev.filter((s) => s.symbol !== symbol));
  }, []);

  const updatePurchases = useCallback((symbol: string, updater: Purchase[] | ((prev: Purchase[]) => Purchase[])) => {
    setStocks((prev) => prev.map((s) => {
      if (s.symbol !== symbol) return s;
      const next = typeof updater === "function" ? updater(s.purchases ?? []) : updater;
      return { ...s, purchases: next };
    }));
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
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </main>
    );
  }

  const missingPriceStocks = stocks.filter((s) =>
    (s.purchases ?? []).some((p) => p.date && p.price == null)
  );

  return (
    <SettingsContext.Provider value={{ trumpEnabled, wolfEnabled }}>
    {missingPriceStocks.length > 0 && (
      <div className="sticky top-0 z-50 flex items-center gap-3 bg-red-600 text-white px-6 py-2.5">
        <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-sm">
          <span className="font-semibold">Purchase price unavailable</span>
          {" — "}could not fetch historical price for {missingPriceStocks.map((s) => s.name || s.symbol).join(", ")}. Gain since purchase cannot be calculated.
        </p>
      </div>
    )}
    <main className="min-h-screen bg-gray-50 text-gray-900 p-6">
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
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent">
                Your Portfolio
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-gray-400 text-sm">
                Last 3 months · up to 12 stocks · auto-refresh every 1h
              </p>
              {username && (
                <span className="text-gray-400 text-xs">· {username}</span>
              )}
            </div>
            {lastRefreshed && (
              <p className="text-gray-400 text-xs mt-0.5">
                Last updated {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {(() => {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 30);
              const cutoffStr = cutoff.toISOString().split("T")[0];

              const cutoff7d = new Date();
              cutoff7d.setDate(cutoff7d.getDate() - 7);
              const cutoff7dStr = cutoff7d.toISOString().split("T")[0];

              let total = 0, total30d = 0, total7d = 0;
              let has30d = false, has7d = false;

              for (const s of stocks) {
                const totalShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
                if (totalShares <= 0) continue;
                // Convert from ticker's native currency to portfolio currency
                const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                const toPortfolio = exchangeRate / tickerRate;

                const price = s.data[s.data.length - 1]?.close ?? 0;
                total += totalShares * price * toPortfolio;

                const past30 = s.data.filter((d) => d.date <= cutoffStr);
                const price30d = past30.length > 0 ? past30[past30.length - 1].close : null;
                if (price30d !== null) { total30d += totalShares * price30d * toPortfolio; has30d = true; }

                const past7 = s.data.filter((d) => d.date <= cutoff7dStr);
                const price7d = past7.length > 0 ? past7[past7.length - 1].close : null;
                if (price7d !== null) { total7d += totalShares * price7d * toPortfolio; has7d = true; }
              }

              const change30d = has30d && total30d > 0 ? ((total - total30d) / total30d) * 100 : null;
              const change7d  = has7d  && total7d  > 0 ? ((total - total7d)  / total7d)  * 100 : null;
              const gain30d   = has30d ? total - total30d : null;
              const gain7d    = has7d  ? total - total7d  : null;
              const fmt = (v: number) => v.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 });

              return total > 0 ? (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-400 text-xs w-24 shrink-0">Portfolio value</span>
                    <span className="text-gray-900 text-2xl font-bold tracking-tight">
                      {total.toLocaleString("en-US", { style: "currency", currency })}
                    </span>
                  </div>
                  {change30d !== null && gain30d !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-gray-400 text-xs w-24 shrink-0">Last 30 days {change30d >= 0 ? "gain" : "loss"}</span>
                      <WolfHover isPositive={change30d >= 0}>
                        <TrumpHover isNegative={change30d < 0}>
                          <span className={`text-sm font-medium ${change30d >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {change30d >= 0 ? "+" : ""}{fmt(gain30d)} ({change30d >= 0 ? "+" : ""}{change30d.toFixed(2)}%)
                          </span>
                        </TrumpHover>
                      </WolfHover>
                    </div>
                  )}
                  {change7d !== null && gain7d !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-gray-400 text-xs w-24 shrink-0">Last 7 days {change7d >= 0 ? "gain" : "loss"}</span>
                      <WolfHover isPositive={change7d >= 0}>
                        <TrumpHover isNegative={change7d < 0}>
                          <span className={`text-sm font-medium ${change7d >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {change7d >= 0 ? "+" : ""}{fmt(gain7d)} ({change7d >= 0 ? "+" : ""}{change7d.toFixed(2)}%)
                          </span>
                        </TrumpHover>
                      </WolfHover>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
          <DashboardLeaderboard stocks={stocks.map(s => ({ symbol: s.symbol, name: s.name, data: s.data, purchases: s.purchases, currency: s.currency }))} />
          <TopGainers />
          <div className="shrink-0 pt-1 flex flex-col gap-2">
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign out
            </button>
          </div>
          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            currency={currency}
            onCurrencyChange={setCurrency}
            theme={theme}
            onThemeChange={setTheme}
            trumpEnabled={trumpEnabled}
            onTrumpChange={(v) => { setTrumpEnabled(v); localStorage.setItem("portfolio-trump", String(v)); }}
            wolfEnabled={wolfEnabled}
            onWolfChange={(v) => { setWolfEnabled(v); localStorage.setItem("portfolio-wolf", String(v)); }}
            newsEnabled={newsEnabled}
            onNewsChange={(v) => { setNewsEnabled(v); localStorage.setItem("portfolio-news", String(v)); }}
          />
        </div>

        <div className="flex gap-2 mb-4">
          <TickerSearch
            onAdd={(symbol) => { setError(""); addStockBySymbol(symbol); }}
            disabled={loading || stocks.length >= MAX_STOCKS}
          />
          {loading && <span className="text-gray-400 text-sm self-center">Loading…</span>}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}


        {stocks.length === 0 ? (
          <p className="text-gray-400 text-center mt-24">
            Add a stock ticker above to get started.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stocks.map((s) => s.symbol)} strategy={rectSortingStrategy}>
              {(() => {
                const totalPortfolioValue = stocks.reduce((sum, s) => {
                  const sh = (s.purchases ?? []).reduce((a, p) => a + p.shares, 0);
                  if (sh <= 0) return sum;
                  const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                  return sum + sh * (s.data[s.data.length - 1]?.close ?? 0) * (exchangeRate / tickerRate);
                }, 0);
                return (
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {stocks.map((s, i) => {
                      const sh = (s.purchases ?? []).reduce((a, p) => a + p.shares, 0);
                      const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                      const posVal = sh > 0 ? sh * (s.data[s.data.length - 1]?.close ?? 0) * (exchangeRate / tickerRate) : 0;
                      const portfolioPct = totalPortfolioValue > 0 && posVal > 0 ? (posVal / totalPortfolioValue) * 100 : undefined;
                      return (
                        <SortableStockChart
                          key={s.symbol}
                          symbol={s.symbol}
                          name={s.name}
                          earningsDate={s.earningsDate}
                          data={s.data}
                          color={COLORS[i % COLORS.length]}
                          purchases={s.purchases}
                          onRemove={() => removeStock(s.symbol)}
                          onPurchasesChange={(p) => updatePurchases(s.symbol, p)}
                          theme={theme}
                          portfolioPct={portfolioPct}
                          tickerCurrency={s.currency ?? "USD"}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </SortableContext>
          </DndContext>
        )}

        {stocks.length > 0 && newsEnabled && (
          <div className="mt-8">
            <AllStocksNews stocks={stocks} />
          </div>
        )}

      </div>
    </main>
    </SettingsContext.Provider>
  );
}
