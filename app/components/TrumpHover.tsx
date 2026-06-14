"use client";

import { useState, useRef } from "react";
import { useSettings } from "./SettingsContext";

const QUOTES = [
  "These numbers are a DISGRACE!",
  "Nobody loses like this. Nobody!",
  "RIGGED! Total witch hunt!",
  "Very unfair. Very, very unfair.",
  "This is a TREMENDOUS disaster.",
  "I know markets. This is BAD.",
  "We were winning so much... SAD!",
  "Fake numbers. I don't believe it.",
  "The WORST portfolio. Ever. Period.",
  "My accountant is crying. BIG TEARS.",
  "They're laughing at us. The whole world.",
  "Absolutely terrible. Embarrassing, frankly.",
];

interface Props {
  isNegative: boolean;
  children: React.ReactNode;
}

export default function TrumpHover({ isNegative, children }: Props) {
  const { trumpEnabled } = useSettings();
  const [show, setShow] = useState(false);
  const quoteRef = useRef(QUOTES[0]);

  return (
    <span
      className="relative"
      onMouseEnter={() => {
        if (isNegative && trumpEnabled) {
          quoteRef.current = QUOTES[Math.floor(Math.random() * QUOTES.length)];
          setShow(true);
        }
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="trump-popup absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center gap-1"
          style={{ width: 180 }}
        >
          <span className="block bg-gray-800 text-red-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-red-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trump.jpg" alt="Donald Trump" className="w-36 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
