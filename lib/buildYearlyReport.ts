import { getUserStocks } from "./stockStore";
import { getReportCurrency } from "./users";
import type { YearlyReportData, YearlyStockReport } from "./email";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["ripHistorical", "yahooSurvey"] });

interface StoredPurchase { shares: number; }
interface StoredStock {
  symbol: string;
  name: string;
  currency?: string;
  purchases?: StoredPurchase[];
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
        const totalShares = (s.purchases ?? []).reduce((sum, p) => sum + p.shares, 0);
        const positionValue = totalShares > 0 ? totalShares * priceEnd : null;
        const earningsYr    = totalShares > 0 ? totalShares * (priceEnd - priceStart) : null;

        return { symbol: s.symbol, name: s.name, currentPrice: priceEnd, changeYr, positionValue, earningsYr, currency: s.currency ?? "USD" } as YearlyStockReport;
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

  let total = 0, totalStart = 0, hasData = false;

  for (const r of stockResults) {
    const toDisplay = displayRate / (rates[r.currency] ?? 1);
    const shares = rawStocks.find((s) => s.symbol === r.symbol)?.purchases?.reduce((sum, p) => sum + p.shares, 0) ?? 0;
    if (shares > 0 && r.currentPrice > 0) {
      total += shares * r.currentPrice * toDisplay;
      if (r.changeYr !== null) {
        const priceStart = r.currentPrice / (1 + r.changeYr / 100);
        totalStart += shares * priceStart * toDisplay;
        hasData = true;
      }
    }
  }

  const totalChangeYrPct   = hasData && totalStart > 0 ? ((total - totalStart) / totalStart) * 100 : null;
  const totalEarningsYrUSD = hasData ? total - totalStart : null;

  return {
    username,
    year: reportYear,
    totalValueUSD: total > 0 ? total : null,
    totalChangeYrPct,
    totalEarningsYrUSD,
    currency: reportCurrency,
    stocks: stockResults,
  };
}
