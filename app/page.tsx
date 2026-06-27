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

interface StockData {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: { date: string; close: number }[];
  currency?: string;
  purchases?: Purchase[];
  marketState?: string | null;
  exchangeTimezoneName?: string | null;
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
  return { symbol: json.symbol, name: json.name, earningsDate: json.earningsDate ?? null, data: json.data, currency: json.currency ?? inferCurrency(json.symbol), marketState: json.marketState ?? null, exchangeTimezoneName: json.exchangeTimezoneName ?? null };
}

async function refreshStockData(symbol: string, name?: string) {
  const params = new URLSearchParams({ symbol, noName: "1" });
  if (name) params.set("name", name);
  const res = await fetch(`/api/stocks?${params}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "Failed to fetch");
  return { data: json.data as StockData["data"], earningsDate: (json.earningsDate as string | null) ?? null, currency: (json.currency as string | undefined), symbol: (json.symbol as string | undefined), marketState: (json.marketState as string | null) ?? null, exchangeTimezoneName: (json.exchangeTimezoneName as string | null) ?? null };
}

export default function Home() {
  const { data: session, status } = useSession();
  const username = session?.user?.name ?? null;

  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [pullY, setPullY] = useState(0);
  const touchStartY = useRef(0);
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
  const [drawdownDate, setDrawdownDate] = useState<string>("");
  const [growthRate, setGrowthRate] = useState<number>(10);
  const [inflationRate, setInflationRate] = useState<number>(2.5);
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
        if (typeof p.drawdownDate === "string") setDrawdownDate(p.drawdownDate);
        if (typeof p.growthRate === "number") setGrowthRate(p.growthRate);
        if (typeof p.inflationRate === "number") setInflationRate(p.inflationRate);
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
    let cancelled = false;
    fetch(`https://open.er-api.com/v6/latest/USD`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rates: Record<string, number> = { USD: 1, ...data.rates };
        setUsdRates(rates);
        setExchangeRate(rates[currency] ?? 1);
      })
      .catch(() => { if (!cancelled) setExchangeRate(1); });
    return () => { cancelled = true; };
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
                .then(({ data, earningsDate, currency, symbol: corrected, marketState, exchangeTimezoneName }) => ({ ...s, data: (data && data.length > 0) ? data : s.data, earningsDate, currency: s.currency ?? currency ?? inferCurrency(s.symbol), symbol: corrected ?? s.symbol, marketState: marketState ?? s.marketState, exchangeTimezoneName: exchangeTimezoneName ?? s.exchangeTimezoneName }))
                .catch(() => ({ ...s, currency: s.currency ?? inferCurrency(s.symbol) }))
            )
          );
          // Preserve in-memory purchase prices and any stocks added while loading
          serverLoaded.current = true;
          setStocks((prev) => {
            const refreshedSymbols = new Set(refreshed.map((r) => r.symbol));
            const merged = refreshed.map((r) => {
              const cur = prev.find((p) => p.symbol === r.symbol);
              if (!cur?.purchases) return r;
              const mergedPurchases = (r.purchases ?? cur.purchases).map((rp, i) => {
                const cp = cur.purchases?.[i];
                return cp?.price != null && rp.price == null ? { ...rp, price: cp.price } : rp;
              });
              return { ...r, purchases: mergedPurchases };
            });
            // Keep any stocks added to state while the initial load was in flight
            const extras = prev.filter((p) => !refreshedSymbols.has(p.symbol));
            return [...merged, ...extras];
          });
          setLastRefreshed(new Date());
        } else {
          // Server is empty — migrate legacy localStorage data if any
          const legacy: StockData[] = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]");
          serverLoaded.current = true;
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
  // Prevent the initial localStorage cache from overwriting the server before
  // the server fetch completes — the cache may be incomplete (e.g. PWA cold start).
  const serverLoaded = useRef(false);
  useEffect(() => {
    if (!username) return;
    if (!saveRef.current) { saveRef.current = true; return; } // skip mount
    localStorage.setItem(cacheKey(username), JSON.stringify(stocks)); // always update local cache
    if (!serverLoaded.current) return; // don't overwrite server until it's been read
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
            refreshStockData(s.symbol, s.name)
              .then(({ data, earningsDate, currency, symbol: corrected, marketState, exchangeTimezoneName }) => ({ ...s, data: (data && data.length > 0) ? data : s.data, earningsDate, currency: s.currency ?? currency ?? inferCurrency(s.symbol), symbol: corrected ?? s.symbol, marketState: marketState ?? s.marketState, exchangeTimezoneName: exchangeTimezoneName ?? s.exchangeTimezoneName }))
              .catch(() => s)
          )
        )
          .then((results) => {
            setStocks((prev) => {
              const refreshedSymbols = new Set(results.map((r) => r.symbol));
              const extras = prev.filter((p) => !refreshedSymbols.has(p.symbol));
              return [...results, ...extras];
            });
            setLastRefreshed(new Date());
          })
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
          refreshStockData(s.symbol, s.name)
            .then(({ data, earningsDate, currency, symbol: corrected, marketState, exchangeTimezoneName }) => ({
              ...s, data: (data && data.length > 0) ? data : s.data, earningsDate,
              currency: s.currency ?? currency ?? inferCurrency(s.symbol),
              symbol: corrected ?? s.symbol,
              marketState: marketState ?? s.marketState,
              exchangeTimezoneName: exchangeTimezoneName ?? s.exchangeTimezoneName,
            }))
            .catch(() => s)
        )
      );
      setStocks((prev) => {
        const refreshedSymbols = new Set(results.map((r) => r.symbol));
        const extras = prev.filter((p) => !refreshedSymbols.has(p.symbol));
        return [...results, ...extras];
      });
      setLastRefreshed(new Date());
    } catch { /* non-fatal */ } finally {
      setRefreshing(false);
    }
  }, [stocks, refreshing]);

  // Re-fetch when tab becomes visible after being hidden for >1 minute,
  // or when the page is restored from BFCache (pageshow with persisted=true)
  useEffect(() => {
    const isStale = () => !lastRefreshed || Date.now() - lastRefreshed.getTime() > 60 * 1000;
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (isStale()) handleRefresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted && isStale()) handleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [lastRefreshed, handleRefresh]);

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

  const updateCurrency = useCallback((symbol: string, currency: string) => {
    setStocks((prev) => prev.map((s) => s.symbol === symbol ? { ...s, currency } : s));
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
    <main
      className="min-h-screen page-bg text-gray-900 p-3 sm:p-6"
      onTouchStart={(e) => { touchStartY.current = e.touches[0].clientY; }}
      onTouchMove={(e) => {
        if (refreshing) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (window.scrollY === 0 && delta > 0) setPullY(Math.min(delta, 80));
      }}
      onTouchEnd={() => {
        if (pullY >= 60) handleRefresh();
        setPullY(0);
      }}
    >
      {pullY > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center transition-all"
          style={{ height: pullY, background: "transparent" }}
        >
          <div className={`flex items-center gap-2 text-xs text-indigo-600 ${pullY >= 60 ? "opacity-100" : "opacity-50"}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={pullY >= 60 ? { transform: "rotate(180deg)" } : {}}>
              <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>
            {pullY >= 60 ? "Release to refresh" : "Pull to refresh"}
          </div>
        </div>
      )}
      <style>{`
        .logo-text {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 40%, #10b981 70%, #6366f1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .logo-badge {
          box-shadow: 0 4px 20px rgba(99,102,241,0.35), 0 1px 4px rgba(0,0,0,0.15);
        }
        .logo-underline {
          background: linear-gradient(90deg, #6366f1, #8b5cf6 50%, #10b981);
        }
        .logo-live-dot { opacity: 1; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 639px) {
          .stocks-grid { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 640px) and (max-width: 1023px) {
          .stocks-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <div className="max-w-screen-xl mx-auto">
        <div className="grid grid-cols-[1fr_auto] items-start gap-x-4 sm:gap-x-6 mb-4 sm:mb-6">
          <div className="flex flex-wrap items-start gap-3 sm:gap-6 min-w-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-5 mb-2">
              <div className="relative shrink-0">
              <div className="logo-badge relative bg-gradient-to-br from-indigo-600 via-violet-600 to-emerald-500 p-3 sm:p-4 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent pointer-events-none"/>
                <div className="logo-live-dot absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-300"/>
                {/* Charging bull — Wall Street style */}
                <svg width="60" height="46" viewBox="0 0 100 66" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 10,30 C 4,18 4,8 8,2" stroke="white" strokeWidth="5" strokeLinecap="round" fill="none"/>
                  <circle cx="8" cy="1" r="4.5" fill="white"/>
                  <ellipse cx="44" cy="44" rx="34" ry="20" fill="white"/>
                  <ellipse cx="66" cy="26" rx="18" ry="13" fill="white"/>
                  <ellipse cx="82" cy="48" rx="14" ry="10" transform="rotate(-18 82 48)" fill="white"/>
                  <ellipse cx="90" cy="54" rx="8" ry="6" fill="white"/>
                  <path d="M 84,38 C 90,28 96,20 94,12" stroke="white" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
                  <path d="M 76,34 C 80,24 86,16 84,8" stroke="white" strokeWidth="4.5" strokeLinecap="round" fill="none"/>
                  <path d="M 72,60 C 76,63 80,66 84,66" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
                  <path d="M 80,62 C 83,64 86,66 88,64" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
                  <path d="M 26,60 C 22,63 18,66 14,66" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
                  <path d="M 36,62 C 32,64 28,66 25,65" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none"/>
                </svg>
              </div>
              </div>
              <div>
                <h1 className="logo-text text-3xl sm:text-5xl font-black tracking-tight leading-none">
                  {t.appTitle}
                </h1>
                <div className="logo-underline h-0.5 mt-2 rounded-full w-2/3 opacity-60" />
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

              let total = 0, total30d = 0, total1yr = 0;
              let has30d = false, has1yr = false;

              for (const s of stocks) {
                const totalShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
                if (totalShares <= 0) continue;
                // Convert from ticker's native currency to portfolio currency
                const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                const toPortfolio = exchangeRate / tickerRate;

                const price = s.data?.at(-1)?.close ?? 0;
                total += totalShares * price * toPortfolio;

                const past30 = (s.data ?? []).filter((d) => d.date <= cutoffStr);
                const price30d = past30.length > 0 ? past30[past30.length - 1].close : null;
                if (price30d !== null) { total30d += totalShares * price30d * toPortfolio; has30d = true; }

                // Find closest trading day at or just after the 1-year mark (handles weekends/holidays)
                const near1yr = (s.data ?? []).filter((d) => d.date >= cutoff1yrStr && d.date <= cutoff1yrEndStr);
                const price1yr = near1yr.length > 0 ? near1yr[0].close : null;
                if (price1yr !== null) { total1yr += totalShares * price1yr * toPortfolio; has1yr = true; }

              }

              const change30d = has30d && total30d > 0 ? ((total - total30d) / total30d) * 100 : null;
              const change1yr = has1yr && total1yr > 0 ? ((total - total1yr) / total1yr) * 100 : null;
              const gain30d   = has30d ? total - total30d : null;
              const gain1yr   = has1yr ? total - total1yr : null;

              const fmt = (v: number) => formatCurrency(v, currency, 0);

              const monthlyBudget = (() => {
                if (!drawdownDate || total <= 0) return null;
                const target = new Date(drawdownDate);
                const now = new Date();
                const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
                if (months <= 0) return null;
                const simple = total / months;
                // Annuity formula: PMT = PV * r / (1 - (1+r)^-n)
                const annuity = (rate: number) => total * rate / (1 - Math.pow(1 + rate, -months));
                const growth = 1 + growthRate / 100;
                const rNominal = Math.pow(growth, 1 / 12) - 1;
                const rReal = Math.pow(growth / (1 + inflationRate / 100), 1 / 12) - 1;
                const withGrowth = annuity(rNominal);
                const withGrowthReal = rReal > 0 ? annuity(rReal) : simple;
                return { simple, withGrowth, withGrowthReal, months };
              })();

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
                  {monthlyBudget && (
                    <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-gray-100">
                      <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-0.5">{t.monthlyBudgetHeader}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600 text-xs w-24 shrink-0">{t.monthlyBudget}</span>
                        <span className="text-indigo-600 text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(monthlyBudget.simple, currency, 0)}
                          <span className="text-gray-400 font-normal ml-1.5 text-xs">end date: {new Date(drawdownDate).toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", { month: "short", year: "numeric" })}</span>
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600 text-xs w-24 shrink-0">{t.monthlyBudgetGrowth}</span>
                        <span className="text-indigo-600 text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(monthlyBudget.withGrowth, currency, 0)}
                          <span className="text-gray-400 font-normal ml-1.5 text-xs">+{growthRate}%/yr · end date: {new Date(drawdownDate).toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", { month: "short", year: "numeric" })}</span>
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-gray-600 text-xs w-24 shrink-0">{t.monthlyBudgetReal}</span>
                        <span className="text-indigo-600 text-sm font-semibold whitespace-nowrap">
                          {formatCurrency(monthlyBudget.withGrowthReal, currency, 0)}
                          <span className="text-gray-400 font-normal ml-1.5 text-xs">+{growthRate}% −{inflationRate}% infl. · end date: {new Date(drawdownDate).toLocaleDateString(language === "sv" ? "sv-SE" : "en-GB", { month: "short", year: "numeric" })}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null;
            })()}
          </div>
          {leaderboardEnabled && <div className="hidden lg:block"><DashboardLeaderboard stocks={stocks.map(s => ({ symbol: s.symbol, name: s.name, data: s.data, purchases: s.purchases, currency: s.currency }))} usdRates={usdRates} /></div>}
          {topGainersEnabled && <div className="hidden lg:block"><TopGainers /></div>}
          </div>{/* end left content wrapper */}
          <div className="shrink-0 pt-1 flex flex-col gap-2 self-start">
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
              onClick={handleRefresh}
              disabled={refreshing}
              className="hidden lg:flex items-center gap-1.5 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-sm font-medium rounded-lg px-3 py-2 transition-colors border border-gray-200 shadow-sm disabled:opacity-50"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={refreshing ? {animation:"spin 1s linear infinite"} : {}}>
                <polyline points="23 4 23 10 17 10"/>
                <polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
              <span className="hidden sm:inline">{refreshing ? "Refreshing…" : "Reload"}</span>
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
              <span className="hidden sm:inline">{t.signOut}</span>
            </button>
          </div>
        </div>{/* end grid */}
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
            drawdownDate={drawdownDate}
            onDrawdownDateChange={(v) => { setDrawdownDate(v); savePrefs({ drawdownDate: v }); }}
            growthRate={growthRate}
            onGrowthRateChange={(v) => { setGrowthRate(v); savePrefs({ growthRate: v }); }}
            inflationRate={inflationRate}
            onInflationRateChange={(v) => { setInflationRate(v); savePrefs({ inflationRate: v }); }}
          />

        <div className="flex gap-2 mb-4">
          <TickerSearch
            onAdd={(symbol) => { setError(""); addStockBySymbol(symbol); }}
            disabled={loading || stocks.length >= MAX_STOCKS}
          />
          {loading && <span className="text-gray-400 text-sm self-center">{t.loading}</span>}
        </div>

        {/* Leaderboard + Top Gainers shown below search on mobile and tablet */}
        <div className="flex flex-wrap gap-3 mb-4 lg:hidden">
          {leaderboardEnabled && <DashboardLeaderboard stocks={stocks.map(s => ({ symbol: s.symbol, name: s.name, data: s.data, purchases: s.purchases, currency: s.currency }))} usdRates={usdRates} />}
          {topGainersEnabled && <div className="w-full"><TopGainers /></div>}
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
                  const sh = (s.purchases ?? []).reduce((a, p) => a + p.shares, 0);
                  if (sh <= 0) return sum;
                  const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                  return sum + sh * (s.data?.at(-1)?.close ?? 0) * (exchangeRate / tickerRate);
                }, 0);
                return (
                  <div
                    className="stocks-grid grid gap-3 sm:gap-4"
                    style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
                  >
                    {stocks.map((s, i) => {
                      const sh = (s.purchases ?? []).reduce((a, p) => a + p.shares, 0);
                      const tickerRate = usdRates[s.currency ?? "USD"] ?? 1;
                      const posVal = sh > 0 ? sh * (s.data?.at(-1)?.close ?? 0) * (exchangeRate / tickerRate) : 0;
                      const portfolioPct = totalPortfolioValue > 0 && posVal > 0 ? (posVal / totalPortfolioValue) * 100 : undefined;
                      const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                      const chartCutoff = threeMonthsAgo.toISOString().split("T")[0];
                      const chartData = (s.data ?? []).filter((d) => d.date >= chartCutoff);
                      return (
                        <SortableStockChart
                          key={s.symbol}
                          symbol={s.symbol}
                          name={s.name}
                          earningsDate={s.earningsDate}
                          data={chartData}
                          color={COLORS[i % COLORS.length]}
                          purchases={s.purchases}
                          onRemove={() => setConfirmRemoveSymbol(s.symbol)}
                          onPurchasesChange={(p) => updatePurchases(s.symbol, p)}
                          onCurrencyChange={(c) => updateCurrency(s.symbol, c)}
                          theme={theme}
                          portfolioPct={portfolioPct}
                          tickerCurrency={s.currency ?? "USD"}
                          marketState={s.marketState ?? null}
                          exchangeTimezoneName={s.exchangeTimezoneName ?? null}
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
