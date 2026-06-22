import { getUserStocks } from "./stockStore";
import { getReportCurrency } from "./users";
import type { YearlyReportData, YearlyStockReport } from "./email";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

interface StoredPurchase { date?: string; shares: number; price?: number; }
interface StoredSale { date?: string; shares: number; price?: number; }
interface StoredStock {
  symbol: string;
  name: string;
  currency?: string;
  purchases?: StoredPurchase[];
  sales?: StoredSale[];
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

export async function buildYearlyReportData(username: string): Promise<YearlyReportData | null> {
  const rawStocks = getUserStocks(username) as StoredStock[];
  if (rawStocks.length === 0) return null;

  // Report covers the previous calendar year
  const reportYear = new Date().getFullYear() - 1;
  const start = new Date(`${reportYear}-01-01`);
  const end   = new Date(`${reportYear}-12-31`);

  const rawResults = await Promise.all(
    rawStocks.map(async (s) => {
      try {
        const chart = await yf.chart(s.symbol, { period1: start, period2: end, interval: "1d" }, { validateResult: false });
        const quotes: { date: Date; close: number }[] = (chart?.quotes ?? []).filter((q: { close: number }) => q.close != null);
        if (quotes.length < 2) return null;

        const priceStart = quotes[0].close;
        const priceEnd   = quotes[quotes.length - 1].close;
        const changeYr   = ((priceEnd - priceStart) / priceStart) * 100;
        const totalPurchased = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
        const totalSold = (s.sales ?? []).reduce((sum, sale) => sum + sale.shares, 0);
        const totalShares = Math.max(0, totalPurchased - totalSold);
        const positionValue = totalShares > 0 ? totalShares * priceEnd : null;
        const earningsYr    = totalShares > 0 ? totalShares * (priceEnd - priceStart) : null;
        const realizedGain  = calcFifoRealizedGain(s.purchases ?? [], s.sales ?? []);

        return { symbol: s.symbol, name: s.name, currentPrice: priceEnd, changeYr, positionValue, earningsYr, realizedGain: realizedGain || null, currency: s.currency ?? "USD" } as YearlyStockReport;
      } catch {
        return null;
      }
    })
  );

  const stockResults: YearlyStockReport[] = rawResults
    .filter((r): r is YearlyStockReport => r !== null)
    .sort((a, b) => ((b.positionValue ?? -Infinity) - (a.positionValue ?? -Infinity)));

  if (stockResults.length === 0) return null;

  const rates = await fetchRates();
  const reportCurrency = getReportCurrency(username);
  const displayRate = rates[reportCurrency] ?? 1;

  let total = 0, totalStart = 0, hasData = false, totalRealized = 0;

  for (const r of stockResults) {
    const toDisplay = displayRate / (rates[r.currency] ?? 1);
    const raw = rawStocks.find((s) => s.symbol === r.symbol);
    const totalPurchased = raw?.purchases?.reduce((sum, p) => sum + p.shares, 0) ?? 0;
    const totalSold = (raw?.sales ?? []).reduce((sum, sale) => sum + sale.shares, 0);
    const shares = Math.max(0, totalPurchased - totalSold);
    if (shares > 0 && r.currentPrice > 0) {
      total += shares * r.currentPrice * toDisplay;
      if (r.changeYr !== null) {
        const priceStart = r.currentPrice / (1 + r.changeYr / 100);
        totalStart += shares * priceStart * toDisplay;
        hasData = true;
      }
    }
    if (r.realizedGain) totalRealized += r.realizedGain * toDisplay;
  }

  const totalChangeYrPct   = hasData && totalStart > 0 ? ((total - totalStart) / totalStart) * 100 : null;
  const totalEarningsYrUSD = hasData ? total - totalStart : null;

  return {
    username,
    year: reportYear,
    totalValueUSD: total > 0 ? total : null,
    totalChangeYrPct,
    totalEarningsYrUSD,
    totalRealizedGainUSD: totalRealized || null,
    currency: reportCurrency,
    stocks: stockResults,
  };
}
