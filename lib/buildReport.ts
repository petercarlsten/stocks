import { getUserStocks } from "./stockStore";
import { getReportCurrency } from "./users";
import type { ReportData, StockReport } from "./email";

interface StoredPurchase {
  date?: string;
  shares: number;
  price?: number;
}

interface StoredSale {
  date?: string;
  shares: number;
  price?: number;
}

interface StoredStock {
  symbol: string;
  name: string;
  currency?: string;
  purchases?: StoredPurchase[];
  sales?: StoredSale[];
  data?: { date: string; close: number }[];
}

function calcFifoRealizedGain(purchases: StoredPurchase[], sales: StoredSale[]): number {
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
    const totalPurchased = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
    const totalSold = (s.sales ?? []).reduce((sum, sale) => sum + sale.shares, 0);
    const totalShares = Math.max(0, totalPurchased - totalSold);
    const positionValue = totalShares > 0 && current > 0 ? totalShares * current : null;
    const realizedGain = calcFifoRealizedGain(s.purchases ?? [], s.sales ?? []);
    return { symbol: s.symbol, name: s.name, currentPrice: current, change30d, positionValue, realizedGain: realizedGain || null, currency: s.currency ?? "USD" };
  }).sort((a, b) => (b.positionValue ?? -Infinity) - (a.positionValue ?? -Infinity));

  const rates = await fetchRates();
  const reportCurrency = getReportCurrency(username);
  const displayRate = rates[reportCurrency] ?? 1;

  let total = 0, total30d = 0, has30d = false, totalRealized = 0;
  for (const report of stockResults) {
    const toDisplay = displayRate / (rates[report.currency] ?? 1);
    const raw = rawStocks.find((s) => s.symbol === report.symbol);
    const totalPurchased = raw?.purchases?.reduce((sum, p) => sum + p.shares, 0) ?? 0;
    const totalSold = (raw?.sales ?? []).reduce((sum, sale) => sum + sale.shares, 0);
    const shares = Math.max(0, totalPurchased - totalSold);
    if (shares > 0 && report.currentPrice > 0) {
      total += shares * report.currentPrice * toDisplay;
      if (report.change30d !== null) {
        const price30d = report.currentPrice / (1 + report.change30d / 100);
        total30d += shares * price30d * toDisplay;
        has30d = true;
      }
    }
    if (report.realizedGain) totalRealized += report.realizedGain * toDisplay;
  }

  const totalChange30dPct = has30d && total30d > 0 ? ((total - total30d) / total30d) * 100 : null;
  const totalEarnings30d = has30d ? total - total30d : null;
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return {
    username,
    month,
    totalValueUSD: total > 0 ? total : null,
    totalChange30dPct,
    totalEarnings30dUSD: totalEarnings30d,
    totalRealizedGainUSD: totalRealized || null,
    currency: reportCurrency,
    stocks: stockResults,
  };
}
