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

function priceAt(data: { date: string; close: number }[], dateStr: string): number | null {
  // Find most recent close on or before dateStr
  const past = data.filter((d) => d.date <= dateStr);
  return past.length > 0 ? past[past.length - 1].close : null;
}

export async function buildReportData(username: string): Promise<ReportData | null> {
  const rawStocks = getUserStocks(username) as StoredStock[];
  if (rawStocks.length === 0) return null;

  const now = new Date();
  const cutoff30Str = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const cutoff1yrStr = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split("T")[0];

  const rates = await fetchRates();
  const reportCurrency = getReportCurrency(username);
  const displayRate = rates[reportCurrency] ?? 1;

  let total = 0, total30d = 0, total1yr = 0, totalCost = 0;
  let has30d = false, has1yr = false, hasCost = false;

  const stockResults: StockReport[] = rawStocks.map((s) => {
    const data = s.data ?? [];
    const shares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
    const current = data[data.length - 1]?.close ?? 0;
    const toDisplay = displayRate / (rates[s.currency ?? "USD"] ?? 1);

    const price30d = priceAt(data, cutoff30Str);
    const price1yr = priceAt(data, cutoff1yrStr);
    const change30d = price30d && price30d > 0 ? ((current - price30d) / price30d) * 100 : null;
    const change1yr = price1yr && price1yr > 0 ? ((current - price1yr) / price1yr) * 100 : null;

    const positionValue = shares > 0 && current > 0 ? shares * current : null;

    // Accumulate portfolio totals
    if (shares > 0 && current > 0) {
      total += shares * current * toDisplay;
      if (price30d) { total30d += shares * price30d * toDisplay; has30d = true; }
      if (price1yr) { total1yr += shares * price1yr * toDisplay; has1yr = true; }

      // Cost basis (purchase price × shares, in display currency)
      const allHaveCost = (s.purchases ?? []).every((p) => p.price != null && p.price > 0);
      if (allHaveCost) {
        totalCost += (s.purchases ?? []).reduce((sum, p) => sum + p.shares * (p.price!) * toDisplay, 0);
        hasCost = true;
      }
    }

    return {
      symbol: s.symbol,
      name: s.name,
      currentPrice: current,
      change30d,
      change1yr,
      positionValue,
      currency: s.currency ?? "USD",
    };
  }).filter((s) => s.positionValue !== null || s.currentPrice > 0)
    .sort((a, b) => (b.positionValue ?? -Infinity) - (a.positionValue ?? -Infinity));

  if (total === 0) return null;

  const totalChange30dPct  = has30d  && total30d  > 0 ? ((total - total30d)  / total30d)  * 100 : null;
  const totalChange1yrPct  = has1yr  && total1yr  > 0 ? ((total - total1yr)  / total1yr)  * 100 : null;
  const totalChangeCostPct = hasCost && totalCost > 0 ? ((total - totalCost) / totalCost) * 100 : null;

  const month = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const prefs = getPreferences(username);
  const monthlyBudget = ((): MonthlyBudget | undefined => {
    if (!prefs.drawdownDate || !(total > 0)) return undefined;
    const target = new Date(prefs.drawdownDate as string);
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
    totalValueUSD: total,
    totalChange30dPct,
    totalChange1yrPct,
    totalChangeCostPct,
    totalEarnings30dUSD:  has30d  ? total - total30d  : null,
    totalEarnings1yrUSD:  has1yr  ? total - total1yr  : null,
    totalEarningsCostUSD: hasCost ? total - totalCost : null,
    currency: reportCurrency,
    stocks: stockResults,
    monthlyBudget,
  };
}
