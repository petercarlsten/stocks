"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Suggestion {
  symbol: string;
  name: string;
}

interface Props {
  onAdd: (symbol: string) => void;
  disabled: boolean;
}

export default function TickerSearch({ onAdd, disabled }: Props) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const composingRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (composingRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: Suggestion[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
      setHighlighted(-1);
    }, 280);
  }, []);

  useEffect(() => {
    search(input);
  }, [input, search]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function commit(symbol: string) {
    setInput("");
    setSuggestions([]);
    setOpen(false);
    setHighlighted(-1);
    onAdd(symbol.toUpperCase());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlighted >= 0 && suggestions[highlighted]) {
        commit(suggestions[highlighted].symbol);
      } else if (input.trim()) {
        commit(input.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="bg-gray-800 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        placeholder="Ticker, ISIN or company name…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={(e) => {
          composingRef.current = false;
          search(e.currentTarget.value);
        }}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        disabled={disabled}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-50 top-full mt-1 left-0 w-full bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={s.symbol}
              onMouseDown={() => commit(s.symbol)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted ? "bg-indigo-600" : "hover:bg-gray-700"
              }`}
            >
              <span className="text-white font-medium shrink-0 w-16 truncate">{s.symbol}</span>
              <span className="text-gray-400 truncate" title={s.name}>{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
