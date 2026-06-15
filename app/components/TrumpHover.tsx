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

const DOG_QUOTES_SAD = [
  "bork... portfolio go down 🐾",
  "who's a bad investor? me.",
  "I did a sad",
  "no more treats for me",
  "heckin' bamboozled",
  "very concern. much loss.",
  "pls send help and kibble",
  "such disappoint. wow.",
  "why hooman why",
  "I is cry",
];

const SAD_DOG_GIFS = [
  "https://gifdb.com/images/thumbnail/sad-dog-boxer-t04yw3khyjv1a9r1.gif",
  "https://gifdb.com/images/thumbnail/sad-dog-pug-w5cej36jsji5akks.gif",
  "https://gifdb.com/images/thumbnail/crying-sad-dog-egjjss8itoeuc4wr.gif",
  "https://gifdb.com/images/thumbnail/sad-dog-golden-retriever-ju07smtlsg8k955b.gif",
  "https://gifdb.com/images/thumbnail/sad-shiba-inu-dog-65iwshgr52r5r36d.gif",
  "https://gifdb.com/images/thumbnail/sad-dog-dug-cone-of-shame-90mv1cz2w96gwq0a.gif",
  "https://gifdb.com/images/thumbnail/sad-dog-feeling-guilty-2t3z9tuqdr85nf95.gif",
  "https://gifdb.com/images/thumbnail/sad-shiba-inu-crying-dog-egbkqxcl0z5evds2.gif",
];

interface Props {
  isNegative: boolean;
  children: React.ReactNode;
}

export default function TrumpHover({ isNegative, children }: Props) {
  const { funnyMode } = useSettings();
  const [show, setShow] = useState(false);
  const [below, setBelow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const quoteRef = useRef("");
  const gifRef = useRef(SAD_CAT_GIFS[0]);

  const active = isNegative && funnyMode !== "off";

  function handleMouseEnter() {
    if (!active) return;
    if (funnyMode === "cats") {
      quoteRef.current = CAT_QUOTES[Math.floor(Math.random() * CAT_QUOTES.length)];
      gifRef.current = SAD_CAT_GIFS[Math.floor(Math.random() * SAD_CAT_GIFS.length)];
    } else if (funnyMode === "dogs") {
      quoteRef.current = DOG_QUOTES_SAD[Math.floor(Math.random() * DOG_QUOTES_SAD.length)];
      gifRef.current = SAD_DOG_GIFS[Math.floor(Math.random() * SAD_DOG_GIFS.length)];
    } else {
      quoteRef.current = TRUMP_QUOTES[Math.floor(Math.random() * TRUMP_QUOTES.length)];
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    setBelow(rect ? rect.top < 280 : false);
    setShow(true);
  }

  const posClass = below
    ? "top-full mt-2 flex-col"
    : "bottom-full mb-2 flex-col-reverse";

  return (
    <span ref={triggerRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={() => setShow(false)}>
      {children}
      {show && funnyMode === "trump-wolf" && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
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
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 110 }}
        >
          <span className="block bg-gray-800 text-blue-300 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-blue-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifRef.current} alt="Sad cat" className="w-24 rounded-xl shadow-2xl" />
        </span>
      )}
      {show && funnyMode === "dogs" && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 110 }}
        >
          <span className="block bg-gray-800 text-yellow-300 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-yellow-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifRef.current} alt="Sad dog" className="w-24 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
