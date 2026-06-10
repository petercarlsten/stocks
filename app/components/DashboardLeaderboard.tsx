"use client";

interface StockData {
  symbol: string;
  name: string;
  data: { date: string; close: number }[];
}

interface Props {
  stocks: StockData[];
}

export default function DashboardLeaderboard({ stocks }: Props) {
  if (stocks.length === 0) return null;

  const ranked = stocks
    .map((s) => {
      const first = s.data[0]?.close ?? 0;
      const last = s.data[s.data.length - 1]?.close ?? 0;
      const gain = first ? ((last - first) / first) * 100 : 0;
      return { symbol: s.symbol, name: s.name, gain };
    })
    .sort((a, b) => b.gain - a.gain);

  return (
    <div className="bg-gray-900 rounded-xl p-4 w-96 shrink-0">
      <h2 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
        Your Top Gainers
      </h2>
      <p className="text-gray-600 text-xs mb-3">Last 3 months</p>
      <ol className="flex flex-col gap-2">
        {ranked.map((s, i) => (
          <li key={s.symbol} className="flex items-center gap-2 min-w-0">
            <span className="text-gray-600 text-xs w-3 shrink-0">{i + 1}</span>
            <span className="text-white text-sm font-medium shrink-0">{s.symbol}</span>
            <span className="text-gray-500 text-xs truncate flex-1">{s.name}</span>
            <span className={`text-sm font-medium shrink-0 ${s.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
              {s.gain >= 0 ? "+" : ""}{s.gain.toFixed(1)}%
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
