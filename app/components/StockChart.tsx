"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  close: number;
}

interface Props {
  symbol: string;
  name: string;
  data: DataPoint[];
  onRemove: () => void;
  color: string;
}

export default function StockChart({ symbol, name, data, onRemove, color }: Props) {
  const first = data[0]?.close ?? 0;
  const last = data[data.length - 1]?.close ?? 0;
  const change = first ? ((last - first) / first) * 100 : 0;
  const positive = change >= 0;

  const min = Math.min(...data.map((d) => d.close));
  const max = Math.max(...data.map((d) => d.close));
  const padding = (max - min) * 0.1 || 1;

  return (
    <div className="bg-gray-900 rounded-xl p-4 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-white font-bold text-lg">{symbol}</span>
            <span
              className={`text-sm font-medium ${positive ? "text-green-400" : "text-red-400"}`}
            >
              {positive ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          </div>
          <div className="text-gray-400 text-xs truncate">{name}</div>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-gray-300 text-lg leading-none"
        >
          ×
        </button>
      </div>
      <div className="text-gray-300 text-sm font-medium">${last.toFixed(2)}</div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            tick={{ fill: "#9CA3AF", fontSize: 10 }}
            tickFormatter={(v) => v.slice(5)}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min - padding, max + padding]}
            tick={{ fill: "#9CA3AF", fontSize: 10 }}
            tickFormatter={(v) => `$${v.toFixed(0)}`}
            width={48}
          />
          <Tooltip
            contentStyle={{ background: "#1F2937", border: "none", borderRadius: 8 }}
            labelStyle={{ color: "#D1D5DB" }}
            itemStyle={{ color }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Close"]}
          />
          <Line
            type="monotone"
            dataKey="close"
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
