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

const DOG_QUOTES_HAPPY = [
  "WOOF! number go up! 🐾",
  "good boy portfolio!!!",
  "zoomies activated 🐕",
  "tail.exe is going BRRRR",
  "treat time!!! 🦴",
  "much wow. very stonks.",
  "I is rich doggo now",
  "bork bork to the moon!",
  "SQUEAKY TOY ACQUIRED",
  "best day ever!!!",
];

const HAPPY_DOG_GIFS = [
  "https://gifdb.com/images/thumbnail/happy-dog-tail-xamhj8syylfo51r7.gif",
  "https://gifdb.com/images/thumbnail/happy-dog-spin-926f7b58khysf22h.gif",
  "https://gifdb.com/images/thumbnail/corgi-happy-dog-f5tt6wj4t5bnlfi1.gif",
  "https://gifdb.com/images/thumbnail/happy-dog-cute-dance-79lypvi2rqibf87e.gif",
  "https://gifdb.com/images/thumbnail/happy-dog-fist-bump-yqt049xjk42t9dvk.gif",
  "https://gifdb.com/images/thumbnail/dog-dancing-happy-dance-do3arboit2168iuu.gif",
  "https://gifdb.com/images/thumbnail/happy-dog-raining-chicken-500r05ozo66ucidp.gif",
  "https://gifdb.com/images/thumbnail/happy-dog-eating-pizza-50a9sujbh45j9s7q.gif",
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
  const gifRef = useRef(HAPPY_CAT_GIFS[0]);

  const active = isPositive && funnyMode !== "off";

  function handleMouseEnter() {
    if (!active) return;
    if (funnyMode === "dogs") {
      quoteRef.current = DOG_QUOTES_HAPPY[Math.floor(Math.random() * DOG_QUOTES_HAPPY.length)];
      gifRef.current = HAPPY_DOG_GIFS[Math.floor(Math.random() * HAPPY_DOG_GIFS.length)];
    } else {
      quoteRef.current = CAT_QUOTES[Math.floor(Math.random() * CAT_QUOTES.length)];
      gifRef.current = HAPPY_CAT_GIFS[Math.floor(Math.random() * HAPPY_CAT_GIFS.length)];
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
      {show && (funnyMode === "cats" || funnyMode === "dogs") && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 120 }}
        >
          <span className={`block bg-gray-800 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border ${funnyMode === "dogs" ? "text-yellow-300 border-yellow-900" : "text-green-400 border-green-900"}`}>
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifRef.current} alt={funnyMode === "dogs" ? "Happy dog" : "Happy cat"} className="w-28 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
