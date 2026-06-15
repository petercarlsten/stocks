"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import StockChart from "./StockChart";

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
  shares?: number;
  onSharesChange: (shares: number | undefined) => void;
  theme?: "light" | "dark";
  portfolioPct?: number;
  tickerCurrency?: string;
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
