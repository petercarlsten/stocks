"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "./SettingsContext";

interface Suggestion {
  symbol: string;
  name: string;
}

interface Props {
  onAdd: (symbol: string) => void;
  disabled: boolean;
}

export default function TickerSearch({ onAdd, disabled }: Props) {
  const t = useTranslation();
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
        className="bg-white border border-gray-300 rounded-lg px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
        placeholder={t.tickerPlaceholder}
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
        type="search"
        autoComplete="new-password"
      />
      {open && (
        <ul className="absolute z-50 top-full mt-1 left-0 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={s.symbol}
              onMouseDown={() => commit(s.symbol)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                i === highlighted ? "bg-indigo-600 text-white" : "hover:bg-gray-50"
              }`}
            >
              <span className={`font-medium shrink-0 w-16 truncate ${i === highlighted ? "text-white" : "text-gray-900"}`}>{s.symbol}</span>
              <span className={`truncate ${i === highlighted ? "text-indigo-100" : "text-gray-500"}`} title={s.name}>{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
