"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StockChart, { Purchase } from "./StockChart";

interface DataPoint {
  date: string;
  close: number;
}

interface Props {
  symbol: string;
  name: string;
  earningsDate: string | null;
  data: DataPoint[];
  onRemove: () => void;
  color: string;
  purchases?: Purchase[];
  onPurchasesChange: (updater: Purchase[] | ((prev: Purchase[]) => Purchase[])) => void;
  onCurrencyChange?: (currency: string) => void;
  theme?: "light" | "dark";
  portfolioPct?: number;
  tickerCurrency?: string;
  marketState?: string | null;
  exchangeTimezoneName?: string | null;
}

export default function SortableStockChart(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.symbol,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <StockChart {...props} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  );
}
