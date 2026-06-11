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
  const [searching, setSearching] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSuggestions([]);
      setOpen(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++requestIdRef.current;
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data: Suggestion[] = await res.json();
        // Discard stale responses from earlier queries
        if (id !== requestIdRef.current) return;
        setSuggestions(data);
        setOpen(data.length > 0);
        setHighlighted(-1);
      } catch {
        if (id === requestIdRef.current) { setSuggestions([]); setOpen(false); }
      } finally {
        if (id === requestIdRef.current) setSearching(false);
      }
    }, 350);
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
    setSearching(false);
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
      <div className="relative">
        <input
          className="bg-gray-800 rounded-lg px-4 py-2 pr-8 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64"
          placeholder="Ticker or company name…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
        {searching && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="animate-spin w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
          </div>
        )}
      </div>
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
              <span className="text-gray-400 truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
