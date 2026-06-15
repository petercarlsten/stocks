"use client";

import { useState, useRef } from "react";
import { useSettings } from "./SettingsContext";

const TRUMP_QUOTES = [
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

const CAT_QUOTES = [
  "I can has refund? 😿",
  "NOT purrfect!",
  "dis is not fine",
  "brb crying forever",
  "why is this allowed",
  "I did NOT consent to this",
  "hold me 😢",
  "the floor is portfolio now",
  "meow... *sobs*",
  "sadge cat moment",
  "my portfolio... it hurts",
  "crying in meow",
];

const SAD_CAT_GIFS = [
  "https://gifdb.com/images/thumbnail/crying-cat-3edeiy96mwa2u8h4.gif",
  "https://gifdb.com/images/thumbnail/screaming-crying-cat-xl6msgx53ws3shux.gif",
  "https://gifdb.com/images/thumbnail/blubbering-sad-crying-cat-auepqb36go1kckph.gif",
  "https://gifdb.com/images/thumbnail/shocked-crying-cat-8hch9jawuce2q36u.gif",
  "https://gifdb.com/images/thumbnail/crying-cat-shouting-3bsbhl1wog57uk4c.gif",
  "https://gifdb.com/images/thumbnail/so-lonely-crying-cat-1ri2ahadswvhizma.gif",
  "https://gifdb.com/images/thumbnail/emotional-tearful-crying-cat-d6lzpnqx5t409ski.gif",
  "https://gifdb.com/images/thumbnail/big-eyes-crying-cat-77mmitfzhm1hnp7j.gif",
];

interface Props {
  isNegative: boolean;
  children: React.ReactNode;
}

export default function TrumpHover({ isNegative, children }: Props) {
  const { funnyMode } = useSettings();
  const [show, setShow] = useState(false);
  const quoteRef = useRef("");
  const catGifRef = useRef(SAD_CAT_GIFS[0]);

  const active = isNegative && funnyMode !== "off";

  return (
    <span
      className="relative"
      onMouseEnter={() => {
        if (active) {
          const quotes = funnyMode === "cats" ? CAT_QUOTES : TRUMP_QUOTES;
          quoteRef.current = quotes[Math.floor(Math.random() * quotes.length)];
          catGifRef.current = SAD_CAT_GIFS[Math.floor(Math.random() * SAD_CAT_GIFS.length)];
          setShow(true);
        }
      }}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && funnyMode === "trump-wolf" && (
        <span
          className="trump-popup absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center gap-1"
          style={{ width: 90 }}
        >
          <span className="block bg-gray-800 text-red-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-red-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trump.jpg" alt="Donald Trump" className="w-18 rounded-xl shadow-2xl" />
        </span>
      )}
      {show && funnyMode === "cats" && (
        <span
          className="trump-popup absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center gap-1"
          style={{ width: 110 }}
        >
          <span className="block bg-gray-800 text-blue-300 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-blue-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catGifRef.current}
            alt="Sad cat"
            className="w-24 rounded-xl shadow-2xl"
          />
        </span>
      )}
    </span>
  );
}
