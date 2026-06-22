"use client";

import { useState, useRef } from "react";
import { useSettings } from "./SettingsContext";

const TRUMP_QUOTES_POSITIVE = [
  "BEAUTIFUL! The BEST gains!",
  "Nobody wins like us. NOBODY.",
  "This is WINNING. Tremendous!",
  "MASSIVE returns. Believe me.",
  "We're making money again!",
  "The greatest investment. Ever.",
  "Incredible numbers. Huge!",
  "My accountant is crying. HAPPY TEARS.",
  "This is what winning looks like!",
  "PERFECT. Absolutely perfect.",
  "I've never seen numbers this good. EVER.",
  "They said it couldn't be done. Wrong!",
  "Smart money. Very smart money.",
  "Genius move. Total genius.",
  "The markets love me. They really do.",
  "Bigly profits. The biggest.",
  "We're rich again, folks!",
  "Even my enemies are impressed.",
  "That's called being a WINNER.",
  "Maybe the best investment in history.",
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
  "OMG OMG OMG green numbers!!!",
  "doing a happy bounce 🐕",
  "this calls for ZOOMIES",
  "i helped. i think i helped.",
  "pls pet me i did good",
  "smol brain, big gains 🐾",
  "wag wag wag wag wag",
  "i deserve ALL the treats",
  "money smell good",
  "fetch! but make it profitable",
];

const CAT_QUOTES = [
  "I can has gainz? 😸",
  "purrfect investment!",
  "this is fine (it's actually fine)",
  "meow-nificent returns!",
  "I knocked the red numbers off the screen",
  "green means nap time 😻",
  "cats always land on their feet... and in the green",
  "purring intensifies",
  "I am RICH cat now",
  "fish for everyone tonight!",
  "heh. called it.",
  "flexing my whiskers rn",
  "I sat on this stock and it GREW",
  "nine lives, nine income streams",
  "the market fears me 😼",
  "treats? no. TUNA. because we can afford it.",
  "my financial advisor is a ball of yarn. still beat the index.",
  "yes. more. keep going.",
  "not even surprised. I'm a cat.",
  "pur... pur... PROFIT",
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

const CHUCK_QUOTES_POSITIVE = [
  "Chuck Norris doesn't buy low and sell high. Stocks rise when he buys.",
  "The market was scared of Chuck. It went up.",
  "Chuck Norris doesn't diversify. The portfolio diversifies itself.",
  "These gains? Chuck Norris sneezed near this ticker.",
  "Chuck Norris doesn't predict the market. The market predicts Chuck.",
  "Interest compounds for others. For Chuck, it apologizes.",
  "Chuck Norris once stared at a red stock. It turned green.",
  "The bulls run because Chuck is behind them.",
  "Chuck Norris doesn't have a broker. Brokers have Chuck.",
  "This stock heard Chuck was watching. It performed.",
  "Wall Street feared Chuck. The Dow rose.",
  "Chuck Norris roundhouse kicked inflation. It worked.",
  "Chuck doesn't check the market. The market checks with Chuck.",
  "Warren Buffett has a Chuck Norris poster on his wall.",
  "Chuck Norris can make money in a bear market. Bears don't argue.",
  "The S&P 500 is just Chuck Norris's savings account.",
  "Green candles only. Chuck demanded it.",
  "Chuck Norris invested once. The stock split out of respect.",
  "Even the shorts covered when Chuck bought in.",
  "Chuck Norris's portfolio doesn't dip. Gravity doesn't apply.",
  "Death and taxes are certain. Chuck Norris gains are more certain.",
  "Chuck Norris counted to infinity. Twice. Both times it was green.",
  "Chuck Norris doesn't need compound interest. Numbers fear him.",
];

const CHUCK_GIFS_POSITIVE = [
  "https://gifdb.com/images/thumbnail/chuck-norris-approved-t1k3m7tzbwexgupb.gif",
  "https://gifdb.com/images/thumbnail/chuck-norris-thumbs-up-and-down-233l5orexlav8a2s.gif",
  "https://gifdb.com/images/thumbnail/chuck-norris-thumbs-up-along-other-personalities-j70eg20n127qd5g6.gif",
  "https://gifdb.com/images/thumbnail/chuck-norris-thumbs-up-hitting-year-2017-2018-94mv8z95tgffjraj.gif",
  "https://gifdb.com/images/thumbnail/dodgeball-chuck-norris-thumbs-up-gw1y5db5hvvz92hg.gif",
  "https://gifdb.com/images/thumbnail/quicktrip-chuck-norris-thumbs-up-watch-out-86yc3h9ya6zwst53.gif",
  "https://gifdb.com/images/thumbnail/chuck-norris-thumbs-up-guy-face-swap-animation-dezgxf61todnirea.gif",
  "https://gifdb.com/images/thumbnail/good-luck-chuck-norris-thumbs-up-8zbpprqqvlydr3oi.gif",
  "https://gifdb.com/images/thumbnail/dodgeball-thank-you-chuck-norris-r4q45prxu3ws8a17.gif",
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
    if (funnyMode === "trump-wolf") {
      quoteRef.current = TRUMP_QUOTES_POSITIVE[Math.floor(Math.random() * TRUMP_QUOTES_POSITIVE.length)];
    } else if (funnyMode === "dogs") {
      quoteRef.current = DOG_QUOTES_HAPPY[Math.floor(Math.random() * DOG_QUOTES_HAPPY.length)];
      gifRef.current = HAPPY_DOG_GIFS[Math.floor(Math.random() * HAPPY_DOG_GIFS.length)];
    } else if (funnyMode === "chuck") {
      quoteRef.current = CHUCK_QUOTES_POSITIVE[Math.floor(Math.random() * CHUCK_QUOTES_POSITIVE.length)];
      gifRef.current = CHUCK_GIFS_POSITIVE[Math.floor(Math.random() * CHUCK_GIFS_POSITIVE.length)];
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
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 90 }}
        >
          <span className="block bg-gray-800 text-green-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-green-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/trump.jpg" alt="Donald Trump" className="w-18 rounded-xl shadow-2xl" />
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
      {show && funnyMode === "chuck" && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 120 }}
        >
          <span className="block bg-gray-800 text-orange-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-orange-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifRef.current} alt="Chuck Norris" className="w-28 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
