import { getUserStocks } from "./stockStore";
import { getReportCurrency, getPreferences } from "./users";
import type { ReportData, StockReport, MonthlyBudget } from "./email";

interface StoredPurchase {
  date?: string;
  shares: number;
  price?: number;
}

interface StoredStock {
  symbol: string;
  name: string;
  currency?: string;
  purchases?: StoredPurchase[];
  data?: { date: string; close: number }[];
}

async function fetchRates(): Promise<Record<string, number>> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    const d = await res.json();
    return { USD: 1, ...d.rates };
  } catch {
    return { USD: 1 };
  }
}

export async function buildReportData(username: string): Promise<ReportData | null> {
  const rawStocks = getUserStocks(username) as StoredStock[];
  if (rawStocks.length === 0) return null;

  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().split("T")[0];

  const stockResults: StockReport[] = rawStocks.map((s) => {
    const data = s.data ?? [];
    const current = data[data.length - 1]?.close ?? 0;
    const past30 = data.filter((d) => d.date <= cutoff30Str);
    const price30d = past30.length > 0 ? past30[past30.length - 1].close : null;
    const change30d = price30d && price30d > 0 ? ((current - price30d) / price30d) * 100 : null;
    const totalShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
    const positionValue = totalShares > 0 && current > 0 ? totalShares * current : null;
    return { symbol: s.symbol, name: s.name, currentPrice: current, change30d, positionValue, currency: s.currency ?? "USD" };
  }).sort((a, b) => (b.positionValue ?? -Infinity) - (a.positionValue ?? -Infinity));

  const rates = await fetchRates();
  const reportCurrency = getReportCurrency(username);
  const displayRate = rates[reportCurrency] ?? 1;

  let total = 0, total30d = 0, has30d = false;
  for (const report of stockResults) {
    const toDisplay = displayRate / (rates[report.currency] ?? 1);
    const raw = rawStocks.find((s) => s.symbol === report.symbol);
    const shares = raw?.purchases?.reduce((sum, p) => sum + p.shares, 0) ?? 0;
    if (shares > 0 && report.currentPrice > 0) {
      total += shares * report.currentPrice * toDisplay;
      if (report.change30d !== null) {
        const price30d = report.currentPrice / (1 + report.change30d / 100);
        total30d += shares * price30d * toDisplay;
        has30d = true;
      }
    }
  }

  const totalChange30dPct = has30d && total30d > 0 ? ((total - total30d) / total30d) * 100 : null;
  const totalEarnings30d = has30d ? total - total30d : null;
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prefs = getPreferences(username);
  const monthlyBudget = ((): MonthlyBudget | undefined => {
    if (!prefs.drawdownDate || !(total > 0)) return undefined;
    const target = new Date(prefs.drawdownDate as string);
    const now = new Date();
    const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
    if (months <= 0) return undefined;
    const growthRate = typeof prefs.growthRate === "number" ? prefs.growthRate : 10;
    const inflationRate = typeof prefs.inflationRate === "number" ? prefs.inflationRate : 2.5;
    const annuity = (rate: number) => total * rate / (1 - Math.pow(1 + rate, -months));
    const growth = 1 + growthRate / 100;
    const rNominal = Math.pow(growth, 1 / 12) - 1;
    const rReal = Math.pow(growth / (1 + inflationRate / 100), 1 / 12) - 1;
    return {
      simple: total / months,
      withGrowth: annuity(rNominal),
      withGrowthReal: rReal > 0 ? annuity(rReal) : total / months,
      drawdownDate: prefs.drawdownDate as string,
      growthRate,
      inflationRate,
    };
  })();

  return {
    username,
    month,
    totalValueUSD: total > 0 ? total : null,
    totalChange30dPct,
    totalEarnings30dUSD: totalEarnings30d,
    currency: reportCurrency,
    stocks: stockResults,
    monthlyBudget,
  };
}
