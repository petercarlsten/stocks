"use client";

import { useState, useRef } from "react";
import { useSettings } from "./SettingsContext";

const CAT_QUOTES = [
  "PURRR-FECT gains! 😸",
  "To the moon! 🚀🐱",
  "I am rich cat now",
  "treats incoming!!!",
  "moneys!!! 🐱",
  "stonks go MRRROW",
  "happy cat is happy",
  "buy more. meow.",
  "this is the way 🐾",
  "paws up! we're rich!",
];

const HAPPY_CAT_GIFS = [
  "https://gifdb.com/images/thumbnail/happy-cat-sassy-head-bobbing-uhryv4lr7t7dgfpp.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-funny-smiling-grin-2cxp5723g93tahsv.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-peach-excited-spinning-q5mnqrfbhrgdrdwl.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-funny-big-awkward-smile-face-zs216kptbat3kohr.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-high-five-yeah-meow-mq1f2c2qkdj13dmb.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-you-re-here-excited-jump-414bnrj063t5wry2.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-goma-excited-clapping-thumbs-up-bi9gbnqp2uvxrtu6.gif",
  "https://gifdb.com/images/thumbnail/happy-cat-hands-in-the-air-slow-dancing-gbah5wpamm28t2ul.gif",
];

interface Props {
  isPositive: boolean;
  children: React.ReactNode;
}

export default function WolfHover({ isPositive, children }: Props) {
  const { funnyMode } = useSettings();
  const [show, setShow] = useState(false);
  const [below, setBelow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const quoteRef = useRef("");
  const catGifRef = useRef(HAPPY_CAT_GIFS[0]);

  const active = isPositive && funnyMode !== "off";

  function handleMouseEnter() {
    if (!active) return;
    quoteRef.current = CAT_QUOTES[Math.floor(Math.random() * CAT_QUOTES.length)];
    catGifRef.current = HAPPY_CAT_GIFS[Math.floor(Math.random() * HAPPY_CAT_GIFS.length)];
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
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center ${posClass}`}
          style={{ width: 144 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://gifdb.com/images/high/wolf-of-wall-street-midget-hym6j8cpnvanzigo.gif"
            alt="Wolf of Wall Street"
            className="w-36 rounded-xl shadow-2xl"
          />
        </span>
      )}
      {show && funnyMode === "cats" && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 120 }}
        >
          <span className="block bg-gray-800 text-green-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-green-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={catGifRef.current} alt="Happy cat" className="w-28 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
