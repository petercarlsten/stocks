"use client";

import TrumpHover from "./TrumpHover";
import WolfHover from "./WolfHover";
import { formatCurrency } from "../lib/formatCurrency";
import { useTranslation } from "./SettingsContext";

interface Purchase {
  date?: string;
  shares: number;
  price?: number;
}

interface StockData {
  symbol: string;
  name: string;
  data: { date: string; close: number }[];
  purchases?: Purchase[];
  currency?: string;
}

interface Props {
  stocks: StockData[];
  usdRates?: Record<string, number>;
  className?: string;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtPrice(value: number, currency: string): string {
  return formatCurrency(value, currency);
}

export default function DashboardLeaderboard({ stocks, usdRates = {}, className }: Props) {
  const t = useTranslation();
  if (stocks.length === 0) return null;

  type PricedPurchase = { date: string; shares: number; price: number };
  type Row = StockData & { current: number; avgCost: number; pctGain: number; valueGain: number; valueGainUSD: number; totalShares: number; currency: string; pricedPurchases: PricedPurchase[] };

  const withPurchase: Row[] = stocks
    .flatMap((s) => {
      const priced = (s.purchases ?? [])
        .filter((p): p is { date: string; shares: number; price: number } => !!p.date && p.price != null)
        .sort((a, b) => a.date.localeCompare(b.date));
      if (priced.length === 0) return [];
      const totalShares = priced.reduce((sum, p) => sum + p.shares, 0);
      if (totalShares <= 0) return [];
      const totalCost = priced.reduce((sum, p) => sum + p.shares * p.price, 0);
      const avgCost = totalCost / totalShares;
      const current = s.data[s.data.length - 1]?.close ?? 0;
      const pctGain = avgCost > 0 ? ((current - avgCost) / avgCost) * 100 : 0;
      const valueGain = totalShares * (current - avgCost);
      const currency = s.currency ?? "USD";
      const tickerRate = usdRates[currency] ?? 1;
      const valueGainUSD = valueGain / tickerRate;
      return [{ ...s, current, avgCost, pctGain, valueGain, valueGainUSD, totalShares, currency, pricedPurchases: priced }];
    })
    .sort((a, b) => b.valueGainUSD - a.valueGainUSD);

  return (
    <div className={className ?? "bg-white rounded-xl p-4 w-96 shrink-0 border border-gray-200 shadow-sm"}>
      <h2 className="text-gray-700 text-xs font-semibold uppercase tracking-wider mb-3">
        {t.gainsSincePurchased}
      </h2>
      {withPurchase.length === 0 ? (
        <p className="text-gray-600 text-xs">{t.addPurchasePrompt}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {withPurchase.map((s, i) => {
            const positive = s.pctGain >= 0;
            const gainColor = positive ? "text-green-600" : "text-red-500";
            const sign = positive ? "+" : "";
            return (
              <li key={s.symbol} className="flex items-start gap-2 min-w-0">
                <span className="text-gray-500 text-xs w-3 shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-gray-900 text-sm font-medium truncate" title={s.name}>{s.name}</span>
                    <WolfHover isPositive={positive}>
                      <TrumpHover isNegative={!positive}>
                        <span className={`text-sm font-semibold shrink-0 ${gainColor}`}>
                          {sign}{s.pctGain.toFixed(1)}%
                        </span>
                      </TrumpHover>
                    </WolfHover>
                  </div>
                  <div className="flex items-baseline justify-between gap-2 mt-0.5">
                    <span className="text-gray-700 text-xs tabular-nums">
                      {fmtPrice(s.avgCost, s.currency)} → {fmtPrice(s.current, s.currency)}
                    </span>
                    <span className={`text-xs shrink-0 tabular-nums ${gainColor}`}>
                      {sign}{fmtPrice(s.valueGain, s.currency)}
                      <span className="text-gray-600 font-normal"> total</span>
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {s.pricedPurchases.map((p, j) => {
                      const pctGain = ((s.current - p.price) / p.price) * 100;
                      const pos = pctGain >= 0;
                      return (
                        <div key={j} className="flex items-baseline justify-between gap-2">
                          <span className="text-gray-600 text-xs tabular-nums">
                            {fmtDate(p.date)} · {p.shares} sh @ {fmtPrice(p.price, s.currency)}
                          </span>
                          <span className={`text-xs tabular-nums shrink-0 ${pos ? "text-green-500" : "text-red-400"}`}>
                            {pos ? "+" : ""}{pctGain.toFixed(1)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
