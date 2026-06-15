"use client";

import TrumpHover from "./TrumpHover";
import WolfHover from "./WolfHover";

interface StockData {
  symbol: string;
  name: string;
  data: { date: string; close: number }[];
  purchaseDate?: string;
  purchasePrice?: number;
  shares?: number;
  currency?: string;
}

interface Props {
  stocks: StockData[];
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function fmtPrice(value: number, currency: string): string {
  return value.toLocaleString("en-US", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DashboardLeaderboard({ stocks }: Props) {
  if (stocks.length === 0) return null;

  const withPurchase = stocks
    .filter((s) => s.purchaseDate && s.purchasePrice != null)
    .map((s) => {
      const current = s.data[s.data.length - 1]?.close ?? 0;
      const bought = s.purchasePrice!;
      const pctGain = bought > 0 ? ((current - bought) / bought) * 100 : 0;
      const priceGain = current - bought;
      const valueGain = s.shares && s.shares > 0 ? s.shares * priceGain : null;
      const currency = s.currency ?? "USD";
      return { ...s, current, bought, pctGain, priceGain, valueGain, currency };
    })
    .sort((a, b) => b.pctGain - a.pctGain);

  return (
    <div className="bg-white rounded-xl p-4 w-96 shrink-0 border border-gray-200 shadow-sm">
      <h2 className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">
        Top Gainers Since Purchase
      </h2>
      {withPurchase.length === 0 ? (
        <p className="text-gray-400 text-xs">Set a "Date Purchased" on a card to track gains.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {withPurchase.map((s, i) => {
            const positive = s.pctGain >= 0;
            const gainColor = positive ? "text-green-600" : "text-red-500";
            const sign = positive ? "+" : "";
            return (
              <li key={s.symbol} className="flex items-start gap-2 min-w-0">
                <span className="text-gray-300 text-xs w-3 shrink-0 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  {/* Row 1: name + % */}
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
                  {/* Row 2: bought→current price + value gain */}
                  <div className="flex items-baseline justify-between gap-2 mt-0.5">
                    <span className="text-gray-400 text-xs tabular-nums">
                      {fmtPrice(s.bought, s.currency)} → {fmtPrice(s.current, s.currency)}
                    </span>
                    <span className={`text-xs shrink-0 tabular-nums ${gainColor}`}>
                      {sign}{fmtPrice(s.valueGain ?? s.priceGain, s.currency)}
                      {s.valueGain !== null && <span className="text-gray-400 font-normal"> total</span>}
                    </span>
                  </div>
                  {/* Row 3: date */}
                  <span className="text-gray-300 text-xs">since {fmtDate(s.purchaseDate!)}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
