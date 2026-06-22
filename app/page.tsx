"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import TrumpHover from "./components/TrumpHover";
import GainHover from "./components/GainHover";
import SettingsPanel from "./components/SettingsPanel";
import AdminPanel from "./components/AdminPanel";
import { SettingsContext, type FunnyMode, type Language } from "./components/SettingsContext";
import { useSession, signOut } from "next-auth/react";
import { formatCurrency } from "./lib/formatCurrency";
import { translations } from "./lib/translations";
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

interface Sale {
  date: string;
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
  sales?: Sale[];
}

// Migrate old single-purchase format to the purchases array
function migrateStock(s: StockData & { shares?: number; purchaseDate?: string; purchasePrice?: number }): StockData {
  if (s.purchases) return s;
  const { purchaseDate, purchasePrice, shares, ...rest } = s as typeof s;
  if (!purchaseDate && !shares) return { ...rest };
  return { ...rest, purchases: [{ date: purchaseDate, shares: shares ?? 0, price: purchasePrice }] };
}

const COLORS = ["#6366F1","#10B981","#F59E0B","#EF4444","#3B82F6","#EC4899","#14B8A6","#F97316","#A855F7","#EAB308","#06B6D4","#84CC16","#E11D48","#0EA5E9","#D97706","#7C3AED","#059669","#DC2626","#2563EB","#C026D3","#16A34A","#EA580C","#4F46E5","#0D9488","#B45309","#9333EA","#15803D","#BE123C","#0284C7","#A16207"];

const MAX_STOCKS = 30;
const LEGACY_KEY = "saved-stocks-v2";

const SUFFIX_CURRENCY: Record<string, string> = {
  ".L": "GBP", ".DE": "EUR", ".MU": "EUR", ".HA": "EUR", ".HM": "EUR",
  ".SG": "EUR", ".F": "EUR", ".BE": "EUR", ".DU": "EUR", ".ST": "SEK",
  ".PA": "EUR", ".AS": "EUR", ".MI": "EUR", ".MC": "EUR", ".SW": "CHF",
  ".CO": "DKK", ".HE": "EUR", ".OL": "NOK", ".BR": "EUR", ".VI": "EUR",
  ".HK": "HKD", ".T": "JPY", ".AX": "AUD", ".SI": "SGD", ".KL": "MYR",
  ".NS": "INR",
};

function calcFifoRemainingCostBasis(purchases: Purchase[], sales: Sale[]): number | null {
  const pricedLots = purchases
    .filter((p) => p.date && p.price != null && p.shares > 0)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .map((p) => ({ remaining: p.shares, price: p.price! }));
  if (!pricedLots.length) return null;
  for (const sale of [...sales].sort((a, b) => a.date.localeCompare(b.date))) {
    let toSell = sale.shares;
    for (const lot of pricedLots) {
      if (toSell <= 0) break;
      const used = Math.min(toSell, lot.remaining);
      lot.remaining -= used;
      toSell -= used;
    }
  }
  return pricedLots.reduce((sum, lot) => sum + lot.remaining * lot.price, 0);
}

function calcFifoRealizedGain(
  purchases: Purchase[],
  sales: Sale[]
): number {
  if (!purchases.length || !sales.length) return 0;
  const lots = purchases
    .filter((p) => p.date && p.price != null)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))
    .map((p) => ({ remaining: p.shares, price: p.price! }));
  let realized = 0;
  for (const sale of sales) {
    if (!sale.price) continue;
    let toSell = sale.shares;
    for (const lot of lots) {
      if (toSell <= 0) break;
      const used = Math.min(toSell, lot.remaining);
      realized += used * (sale.price - lot.price);
      lot.remaining -= used;
      toSell -= used;
    }
  }
  return realized;
}

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

async function refreshStockData(symbol: string, name?: string) {
  const params = new URLSearchParams({ symbol, noName: "1" });
  if (name) params.set("name", name);
  const res = await fetch(`/api/stocks?${params}`);
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
  const [funnyMode, setFunnyMode] = useState<FunnyMode>("trump");
  const [newsEnabled, setNewsEnabled] = useState(true);
  const [leaderboardEnabled, setLeaderboardEnabled] = useState(true);
  const [topGainersEnabled, setTopGainersEnabled] = useState(true);
  const [language, setLanguage] = useState<Language>("en");
  const [reportEmail, setReportEmail] = useState("");
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [confirmRemoveSymbol, setConfirmRemoveSymbol] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load saved preferences — localStorage first (instant), then server overrides
  useEffect(() => {
    const savedTheme = localStorage.getItem("portfolio-theme") as "light" | "dark" | null;
    if (savedTheme) setTheme(savedTheme);
    const savedCurrency = localStorage.getItem("portfolio-currency");
    if (savedCurrency) setCurrency(savedCurrency);
    const rawFunnyMode = localStorage.getItem("portfolio-funny-mode");
    const savedFunnyMode = (rawFunnyMode === "trump-wolf" ? "trump" : rawFunnyMode) as FunnyMode | null;
    if (savedFunnyMode) setFunnyMode(savedFunnyMode);
    else if (localStorage.getItem("portfolio-trump") === "false") setFunnyMode("off");
    if (localStorage.getItem("portfolio-news") === "false") setNewsEnabled(false);
    if (localStorage.getItem("portfolio-leaderboard") === "false") setLeaderboardEnabled(false);
    if (localStorage.getItem("portfolio-top-gainers") === "false") setTopGainersEnabled(false);
    const savedLang = localStorage.getItem("portfolio-language") as Language | null;
    if (savedLang === "en" || savedLang === "sv") setLanguage(savedLang);

    // Register service worker for push notifications
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setPushEnabled(true);
      }).catch(() => {});
    }

    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.reportEmail) setReportEmail(d.reportEmail);
        if (d.isAdmin) setIsAdminUser(true);
        // Server preferences override localStorage — this is the source of truth
        const p = d.preferences ?? {};
        if (p.currency) { setCurrency(p.currency); localStorage.setItem("portfolio-currency", p.currency); }
        if (p.theme === "light" || p.theme === "dark") { setTheme(p.theme); localStorage.setItem("portfolio-theme", p.theme); }
        if (p.funnyMode) { const fm = p.funnyMode === "trump-wolf" ? "trump" : p.funnyMode; setFunnyMode(fm as FunnyMode); localStorage.setItem("portfolio-funny-mode", fm); }
        if (typeof p.newsEnabled === "boolean") { setNewsEnabled(p.newsEnabled); localStorage.setItem("portfolio-news", String(p.newsEnabled)); }
        if (typeof p.leaderboardEnabled === "boolean") { setLeaderboardEnabled(p.leaderboardEnabled); localStorage.setItem("portfolio-leaderboard", String(p.leaderboardEnabled)); }
        if (typeof p.topGainersEnabled === "boolean") { setTopGainersEnabled(p.topGainersEnabled); localStorage.setItem("portfolio-top-gainers", String(p.topGainersEnabled)); }
        if (p.language === "en" || p.language === "sv") { setLanguage(p.language as Language); localStorage.setItem("portfolio-language", p.language); }
        // Also sync reportCurrency with currency if set
        if (d.reportCurrency && !p.currency) { setCurrency(d.reportCurrency); localStorage.setItem("portfolio-currency", d.reportCurrency); }
      })
      .catch(() => {});
  }, []);

  // Apply dark class to <html> and persist
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("portfolio-theme", theme);
  }, [theme]);

  // Fetch exchange rates and persist locally
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
              refreshStockData(s.symbol, s.name)
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
            refreshStockData(s.symbol, s.name).then(({ data, earningsDate, currency, symbol: corrected }) => ({ ...s, data, earningsDate, currency: currency ?? s.currency ?? inferCurrency(s.symbol), symbol: corrected ?? s.symbol }))
          )
        )
          .then((results) => { setStocks(results); setLastRefreshed(new Date()); })
          .catch(() => {});
        return current;
      });
    }, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const current = stocks;
      if (current.length === 0) return;
      const results = await Promise.all(
        current.map((s) =>
          refreshStockData(s.symbol, s.name).then(({ data, earningsDate, currency, symbol: corrected }) => ({
            ...s, data, earningsDate,
            currency: currency ?? s.currency ?? inferCurrency(s.symbol),
            symbol: corrected ?? s.symbol,
          }))
        )
      );
      setStocks(results);
      setLastRefreshed(new Date());
    } catch { /* non-fatal */ } finally {
      setRefreshing(false);
    }
  }, [stocks, refreshing]);

  const addStockBySymbol = useCallback(async (symbol: string) => {
    if (stocks.length >= MAX_STOCKS) { setError("Maximum 30 stocks reached."); return; }
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

  const updateSales = useCallback((symbol: string, updater: Sale[] | ((prev: Sale[]) => Sale[])) => {
    setStocks((prev) => prev.map((s) => {
      if (s.symbol !== symbol) return s;
      const next = typeof updater === "function" ? updater(s.sales ?? []) : updater;
      return { ...s, sales: next };
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

  function savePrefs(patch: Record<string, unknown>) {
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: patch }),
    }).catch(() => {});
  }

  const cols = stocks.length <= 2 ? stocks.length || 1 : Math.min(stocks.length, 3);
  const t = translations[language];

  if (status === "loading") {
    return (
      <main className="min-h-screen page-bg flex items-center justify-center">
        <p className="text-gray-400 text-sm">{t.loading}</p>
      </main>
    );
  }

  const missingPriceStocks = stocks.filter((s) =>
    (s.purchases ?? []).some((p) => p.date && p.price == null)
  );

  return (
    <SettingsContext.Provider value={{ funnyMode, language }}>
    {missingPriceStocks.length > 0 && (
      <div className="sticky top-0 z-50 flex items-center gap-3 bg-red-600 text-white px-6 py-2.5">
        <svg className="shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p className="text-sm">
          <span className="font-semibold">{t.purchasePriceUnavailable}</span>
          {" — "}{t.purchasePriceError(missingPriceStocks.map((s) => s.name || s.symbol).join(", "))}
        </p>
      </div>
    )}
    <main className="min-h-screen page-bg text-gray-900 p-3 sm:p-6">
      <style>{`
        @keyframes logo-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes badge-glow {
          0%, 100% { box-shadow: 0 8px 30px -4px rgba(99,102,241,0.55), 0 0 0 0 rgba(99,102,241,0); }
          50% { box-shadow: 0 8px 40px -4px rgba(99,102,241,0.8), 0 0 30px 4px rgba(16,185,129,0.25); }
        }
        .logo-text {
          background: linear-gradient(135deg, #6366f1 0%, #a855f7 35%, #10b981 65%, #6366f1 100%);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: logo-gradient 5s ease infinite;
        }
        .logo-badge {
          animation: badge-glow 3s ease-in-out infinite;
        }
        .logo-underline {
          background: linear-gradient(90deg, #6366f1, #a855f7 50%, #10b981);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 639px) {
          .stocks-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .stocks-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <div className="max-w-screen-xl mx-auto">
        <div className="flex flex-wrap items-start gap-3 sm:gap-6 mb-4 sm:mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-5 mb-2">
              <div className="logo-badge bg-gradient-to-br from-indigo-500 via-purple-500 to-emerald-500 p-2 sm:p-3 rounded-xl sm:rounded-2xl shrink-0 flex items-center justify-center">
                {funnyMode === "cats" ? (
                  /* Cat face */
                  <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                    <polygon points="7,22 11,6 19,16" fill="white" opacity="0.95"/>
                    <polygon points="33,22 29,6 21,16" fill="white" opacity="0.95"/>
                    <polygon points="9,21 12,9 18,16" fill="#f9a8d4" opacity="0.7"/>
                    <polygon points="31,21 28,9 22,16" fill="#f9a8d4" opacity="0.7"/>
                    <circle cx="20" cy="26" r="13" fill="white" opacity="0.95"/>
                    <ellipse cx="14" cy="24" rx="2.2" ry="2.8" fill="#4f46e5"/>
                    <ellipse cx="26" cy="24" rx="2.2" ry="2.8" fill="#4f46e5"/>
                    <circle cx="14.7" cy="23" r="0.8" fill="white"/>
                    <circle cx="26.7" cy="23" r="0.8" fill="white"/>
                    <polygon points="20,28 18.2,30.5 21.8,30.5" fill="#f9a8d4"/>
                    <path d="M 16,31.5 Q 20,34 24,31.5" stroke="#9ca3af" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                    <line x1="2" y1="26" x2="15" y2="27.5" stroke="white" strokeWidth="1.1" opacity="0.7"/>
                    <line x1="2" y1="29.5" x2="15" y2="29" stroke="white" strokeWidth="1.1" opacity="0.7"/>
                    <line x1="38" y1="26" x2="25" y2="27.5" stroke="white" strokeWidth="1.1" opacity="0.7"/>
                    <line x1="38" y1="29.5" x2="25" y2="29" stroke="white" strokeWidth="1.1" opacity="0.7"/>
                  </svg>
                ) : funnyMode === "dogs" ? (
                  /* Dog face with tongue */
                  <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                    <ellipse cx="7" cy="23" rx="6" ry="11" fill="white" opacity="0.75"/>
                    <ellipse cx="33" cy="23" rx="6" ry="11" fill="white" opacity="0.75"/>
                    <circle cx="20" cy="19" r="14" fill="white" opacity="0.95"/>
                    <circle cx="14" cy="16" r="3" fill="#4f46e5"/>
                    <circle cx="26" cy="16" r="3" fill="#4f46e5"/>
                    <circle cx="15" cy="15" r="1" fill="white"/>
                    <circle cx="27" cy="15" r="1" fill="white"/>
                    <ellipse cx="20" cy="24" rx="6" ry="4.5" fill="white" opacity="0.6"/>
                    <ellipse cx="20" cy="22.5" rx="3.5" ry="2.5" fill="#1f2937"/>
                    <path d="M 16,27 Q 20,30 24,27" stroke="#6b7280" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    <ellipse cx="20" cy="30" rx="3" ry="2.5" fill="#f87171" opacity="0.95"/>
                    <ellipse cx="20" cy="31.5" rx="2" ry="1.2" fill="#ef4444" opacity="0.7"/>
                  </svg>
                ) : funnyMode === "chuck" ? (
                  /* Chuck Norris: cowboy hat + beard */
                  <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                    {/* Cowboy hat brim */}
                    <ellipse cx="20" cy="12" rx="16" ry="3.5" fill="#92400e"/>
                    {/* Hat crown */}
                    <rect x="11" y="3" width="18" height="10" rx="3" fill="#78350f"/>
                    {/* Hat band */}
                    <rect x="11" y="10" width="18" height="2.5" fill="#451a03"/>
                    {/* Face */}
                    <ellipse cx="20" cy="27" rx="12" ry="12" fill="#fcd9a0"/>
                    {/* Beard */}
                    <ellipse cx="20" cy="33" rx="9" ry="6" fill="#92400e"/>
                    <ellipse cx="20" cy="29" rx="7" ry="5" fill="#a16207"/>
                    {/* Mustache */}
                    <path d="M 14,26 Q 17,28 20,26 Q 23,28 26,26" fill="#78350f"/>
                    {/* Eyes */}
                    <ellipse cx="15" cy="23" rx="2" ry="1.8" fill="#1c1917"/>
                    <ellipse cx="25" cy="23" rx="2" ry="1.8" fill="#1c1917"/>
                    <circle cx="15.6" cy="22.4" r="0.7" fill="white"/>
                    <circle cx="25.6" cy="22.4" r="0.7" fill="white"/>
                    {/* Eyebrows */}
                    <path d="M 12,20.5 Q 15,19 18,20.5" stroke="#78350f" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                    <path d="M 22,20.5 Q 25,19 28,20.5" stroke="#78350f" strokeWidth="1.6" fill="none" strokeLinecap="round"/>
                  </svg>
                ) : funnyMode === "trump" ? (
                  /* Trump face: iconic swept hair + orange face */
                  <svg width="38" height="38" viewBox="0 0 40 40" fill="none">
                    <path d="M 8,22 Q 6,6 16,3 Q 22,0 30,4 Q 36,9 35,18 Q 31,8 20,7 Q 11,7 8,22 Z" fill="#fbbf24"/>
                    <path d="M 30,4 Q 37,10 36,20 Q 34,12 29,9 Z" fill="#f59e0b"/>
                    <ellipse cx="20" cy="27" rx="13" ry="13" fill="#fed7aa"/>
                    <path d="M 8,23 Q 7,12 15,8 Q 12,11 11,18 Z" fill="#f59e0b"/>
                    <ellipse cx="14.5" cy="25" rx="2.5" ry="2" fill="#bfdbfe"/>
                    <ellipse cx="25.5" cy="25" rx="2.5" ry="2" fill="#bfdbfe"/>
                    <path d="M 11,22 Q 14.5,20 18,22" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    <path d="M 22,22 Q 25.5,20 29,22" stroke="#92400e" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                    <path d="M 15,32 Q 20,30.5 25,32" stroke="#c2410c" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
                  </svg>
                ) : (
                  <svg width="44" height="30" viewBox="0 0 56 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polyline points="2,30 12,22 22,26 34,10 46,6 54,2" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    <polygon points="2,30 12,22 22,26 34,10 46,6 54,2 54,34 2,34" fill="white" opacity="0.2"/>
                    <circle cx="54" cy="2" r="3.5" fill="white"/>
                    <circle cx="54" cy="2" r="7" fill="white" opacity="0.15"/>
                  </svg>
                )}
              </div>
              <div>
                <h1 className="logo-text text-3xl sm:text-5xl font-black tracking-tight leading-none">
                  {t.appTitle}
                </h1>
                <div className="logo-underline h-1 mt-2 rounded-full w-3/4" />
              </div>
            </div>
            {username && (
              <span className="text-gray-600 text-xs">{t.username}: <span className="font-bold text-gray-800">{username}</span></span>
            )}
            {lastRefreshed && (
              <p className="text-gray-600 text-xs mt-0.5">
                {t.lastUpdated} {lastRefreshed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {(() => {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 30);
              const cutoffStr = cutoff.toISOString().split("T")[0];

const cutoff1yr = new Date();
              cutoff1yr.setFullYear(cutoff1yr.getFullYear() - 1);
              const cutoff1yrStr = cutoff1yr.toISOString().split("T")[0];
              const cutoff1yrEndStr = new Date(cutoff1yr.getTime() + 10 * 86400000).toISOString().split("T")[0];

              let total = 0, total30d = 0, total1yr = 0, totalRealized = 0, totalCostBasis = 0, totalEverInvested = 0;
              let has30d = false, has1yr = false, hasCostBasis = false;

              for (const s of stocks) {
                const totalSoldShares = (s.sales ?? []).reduce((sum, sale) => sum + sale.shares, 0);
                const totalPurchasedShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
                const totalShares = Math.max(0, totalPurchasedShares - totalSoldShares);
                if (totalShares <= 0 && !(s.sales ?? []).length) continue;
                // Convert from ticker's native currency to portfolio currency
                const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                const toPortfolio = exchangeRate / tickerRate;

                const price = s.data[s.data.length - 1]?.close ?? 0;
                if (totalShares > 0) total += totalShares * price * toPortfolio;

                if (totalShares > 0) {
                  const past30 = s.data.filter((d) => d.date <= cutoffStr);
                  const price30d = past30.length > 0 ? past30[past30.length - 1].close : null;
                  if (price30d !== null) { total30d += totalShares * price30d * toPortfolio; has30d = true; }

                  // Find closest trading day at or just after the 1-year mark (handles weekends/holidays)
                  const near1yr = s.data.filter((d) => d.date >= cutoff1yrStr && d.date <= cutoff1yrEndStr);
                  const price1yr = near1yr.length > 0 ? near1yr[0].close : null;
                  if (price1yr !== null) { total1yr += totalShares * price1yr * toPortfolio; has1yr = true; }

                  // FIFO cost basis of currently held shares (for unrealized gain calc)
                  const fifoCostBasis = calcFifoRemainingCostBasis(s.purchases ?? [], s.sales ?? []);
                  if (fifoCostBasis !== null) {
                    totalCostBasis += fifoCostBasis * toPortfolio;
                    hasCostBasis = true;
                  }
                  // Total ever invested across all purchases including sold ones
                  const pricedPurchases = (s.purchases ?? []).filter((p) => p.price != null && p.shares > 0);
                  totalEverInvested += pricedPurchases.reduce((sum, p) => sum + p.shares * p.price!, 0) * toPortfolio;
                }

                const realized = calcFifoRealizedGain(s.purchases ?? [], s.sales ?? []);
                totalRealized += realized * toPortfolio;
              }

              const change30d = has30d && total30d > 0 ? ((total - total30d) / total30d) * 100 : null;
              const change1yr = has1yr && total1yr > 0 ? ((total - total1yr) / total1yr) * 100 : null;
              const gain30d   = has30d ? total - total30d : null;
              const gain1yr   = has1yr ? total - total1yr : null;
              const fmt = (v: number) => formatCurrency(v, currency, 0);

              return total > 0 ? (
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-gray-600 text-xs w-24 shrink-0">{t.portfolioValue}</span>
                    <span className="text-gray-900 text-2xl font-bold tracking-tight">
                      {formatCurrency(total, currency)}
                    </span>
                  </div>
                  {change1yr !== null && gain1yr !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-gray-600 text-xs w-24 shrink-0">{change1yr >= 0 ? t.lastYearGain : t.lastYearLoss}</span>
                      <GainHover isPositive={change1yr >= 0}>
                        <TrumpHover isNegative={change1yr < 0}>
                          <span className={`text-sm font-medium whitespace-nowrap ${change1yr >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {change1yr >= 0 ? "+" : ""}{fmt(gain1yr)} ({change1yr >= 0 ? "+" : ""}{change1yr.toFixed(2)}%)
                          </span>
                        </TrumpHover>
                      </GainHover>
                    </div>
                  )}
                  {change30d !== null && gain30d !== null && (
                    <div className="flex items-baseline gap-2">
                      <span className="text-gray-600 text-xs w-24 shrink-0">{change30d >= 0 ? t.lastNDaysGain(30) : t.lastNDaysLoss(30)}</span>
                      <GainHover isPositive={change30d >= 0}>
                        <TrumpHover isNegative={change30d < 0}>
                          <span className={`text-sm font-medium whitespace-nowrap ${change30d >= 0 ? "text-green-600" : "text-red-500"}`}>
                            {change30d >= 0 ? "+" : ""}{fmt(gain30d)} ({change30d >= 0 ? "+" : ""}{change30d.toFixed(2)}%)
                          </span>
                        </TrumpHover>
                      </GainHover>
                    </div>
                  )}
                  {hasCostBasis && totalEverInvested > 0 && (() => {
                    const profit = (total - totalCostBasis) + totalRealized;
                    const returnPct = (profit / totalEverInvested) * 100;
                    const positive = profit >= 0;
                    return (
                      <div className="flex flex-col gap-1 mt-0.5 pt-1.5 border-t border-gray-100">
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-600 text-xs w-24 shrink-0">Total invested</span>
                          <span className="text-gray-700 text-sm font-medium whitespace-nowrap">{fmt(totalEverInvested)}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-gray-600 text-xs w-24 shrink-0">You made</span>
                          <GainHover isPositive={positive}>
                            <TrumpHover isNegative={!positive}>
                              <span className={`text-sm font-semibold whitespace-nowrap ${positive ? "text-green-600" : "text-red-500"}`}>
                                {positive ? "+" : ""}{fmt(profit)}
                                <span className="font-normal text-xs ml-1">({positive ? "+" : ""}{returnPct.toFixed(1)}%)</span>
                              </span>
                            </TrumpHover>
                          </GainHover>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : null;
            })()}
          </div>
          {leaderboardEnabled && <div className="hidden lg:block"><DashboardLeaderboard stocks={stocks.map(s => ({ symbol: s.symbol, name: s.name, data: s.data, purchases: s.purchases, sales: s.sales, currency: s.currency }))} usdRates={usdRates} /></div>}
          {topGainersEnabled && <div className="hidden lg:block"><TopGainers /></div>}
          <div className="shrink-0 pt-1 flex flex-row sm:flex-col gap-2 ml-auto sm:ml-0">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={refreshing ? {animation:"spin 1s linear infinite"} : {}}>
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Reload"}</span>
            </button>
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              <span className="hidden sm:inline">{t.settings}</span>
            </button>
            {isAdminUser && (
              <button
                onClick={() => setAdminOpen(true)}
                className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          </div>
          <SettingsPanel
            open={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            currency={currency}
            onCurrencyChange={(v) => { setCurrency(v); savePrefs({ currency: v }); }}
            theme={theme}
            onThemeChange={(v) => { setTheme(v); savePrefs({ theme: v }); }}
            funnyMode={funnyMode}
            onFunnyModeChange={(v) => { setFunnyMode(v); localStorage.setItem("portfolio-funny-mode", v); savePrefs({ funnyMode: v }); }}
            newsEnabled={newsEnabled}
            onNewsChange={(v) => { setNewsEnabled(v); localStorage.setItem("portfolio-news", String(v)); savePrefs({ newsEnabled: v }); }}
            leaderboardEnabled={leaderboardEnabled}
            onLeaderboardChange={(v) => { setLeaderboardEnabled(v); localStorage.setItem("portfolio-leaderboard", String(v)); savePrefs({ leaderboardEnabled: v }); }}
            topGainersEnabled={topGainersEnabled}
            onTopGainersChange={(v) => { setTopGainersEnabled(v); localStorage.setItem("portfolio-top-gainers", String(v)); savePrefs({ topGainersEnabled: v }); }}
            language={language}
            onLanguageChange={(v) => { setLanguage(v); localStorage.setItem("portfolio-language", v); savePrefs({ language: v }); }}
            reportEmail={reportEmail}
            onReportEmailChange={(email) => {
              setReportEmail(email);
              fetch("/api/user/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reportEmail: email }),
              }).catch(() => {});
            }}
            pushEnabled={pushEnabled}
            onPushChange={setPushEnabled}
          />
        </div>

        <div className="flex gap-2 mb-4">
          <TickerSearch
            onAdd={(symbol) => { setError(""); addStockBySymbol(symbol); }}
            disabled={loading || stocks.length >= MAX_STOCKS}
          />
          {loading && <span className="text-gray-400 text-sm self-center">{t.loading}</span>}
        </div>

        {/* Leaderboard + Top Gainers shown below search on mobile and tablet */}
        <div className="flex flex-wrap gap-3 mb-4 lg:hidden">
          {leaderboardEnabled && <DashboardLeaderboard stocks={stocks.map(s => ({ symbol: s.symbol, name: s.name, data: s.data, purchases: s.purchases, sales: s.sales, currency: s.currency }))} usdRates={usdRates} />}
          {topGainersEnabled && <TopGainers />}
        </div>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

{stocks.length === 0 ? (
          <p className="text-gray-400 text-center mt-24">
            {t.addTickerPrompt}
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stocks.map((s) => s.symbol)} strategy={rectSortingStrategy}>
              {(() => {
                const totalPortfolioValue = stocks.reduce((sum, s) => {
                  const sold = (s.sales ?? []).reduce((a, sale) => a + sale.shares, 0);
                  const sh = Math.max(0, (s.purchases ?? []).reduce((a, p) => a + p.shares, 0) - sold);
                  if (sh <= 0) return sum;
                  const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                  return sum + sh * (s.data[s.data.length - 1]?.close ?? 0) * (exchangeRate / tickerRate);
                }, 0);
                return (
                  <div
                    className="stocks-grid grid gap-3 sm:gap-4"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {stocks.map((s, i) => {
                      const soldSh = (s.sales ?? []).reduce((a, sale) => a + sale.shares, 0);
                      const sh = Math.max(0, (s.purchases ?? []).reduce((a, p) => a + p.shares, 0) - soldSh);
                      const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                      const posVal = sh > 0 ? sh * (s.data[s.data.length - 1]?.close ?? 0) * (exchangeRate / tickerRate) : 0;
                      const portfolioPct = totalPortfolioValue > 0 && posVal > 0 ? (posVal / totalPortfolioValue) * 100 : undefined;
                      const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                      const chartCutoff = threeMonthsAgo.toISOString().split("T")[0];
                      const chartData = s.data.filter((d) => d.date >= chartCutoff);
                      return (
                        <SortableStockChart
                          key={s.symbol}
                          symbol={s.symbol}
                          name={s.name}
                          earningsDate={s.earningsDate}
                          data={chartData}
                          color={COLORS[i % COLORS.length]}
                          purchases={s.purchases}
                          sales={s.sales}
                          onRemove={() => setConfirmRemoveSymbol(s.symbol)}
                          onPurchasesChange={(p) => updatePurchases(s.symbol, p)}
                          onSalesChange={(sl) => updateSales(s.symbol, sl)}
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
    <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
    {confirmRemoveSymbol && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConfirmRemoveSymbol(null)}>
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-6 flex flex-col gap-4 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
          <p className="text-gray-900 dark:text-white font-semibold text-base">Remove {confirmRemoveSymbol}?</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm">This will remove the chart and all purchase data for this stock.</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmRemoveSymbol(null)}
              className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => { removeStock(confirmRemoveSymbol); setConfirmRemoveSymbol(null); }}
              className="px-4 py-2 text-sm rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
    )}
    </SettingsContext.Provider>
  );
}
