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
  "This is a HOAX. Has to be.",
  "Disaster. Total and complete disaster.",
  "I've seen bad, but this? This is HISTORIC.",
  "The deep state did this. I know it.",
  "Somebody call my lawyer.",
  "This wouldn't happen on my watch. Oh wait.",
  "Shameful. Frankly, shameful.",
  "Even Sleepy Joe did better. SAD!",
  "I'm going to tweet about this.",
  "The fake news won't cover this loss.",
  "Terrible. The worst. By far.",
  "We need an investigation. Immediately.",
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
  "hiss. just... hiss.",
  "I'm going back under the bed",
  "no. no no no. NO.",
  "this is NOT what I purred for",
  "my whiskers are trembling",
  "staring into the void now",
  "I knocked it off the table. it fell.",
  "purring but make it sad",
  "someone open a can of tuna pls",
  "I am become loss",
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
  "tail between legs rn",
  "dropped the ball. literally.",
  "not a good boy today",
  "whimper...",
  "I chewed the wrong stock",
  "this is not the walkies I wanted",
  "burying my losses in the yard",
  "bed. I go to bed now.",
  "sad puppy eyes activated",
  "no zoomies today",
];

const CHUCK_QUOTES_NEGATIVE = [
  "Chuck Norris is aware of this loss. Be afraid.",
  "Chuck Norris doesn't lose money. He lends it to gravity.",
  "Whoever shorted this will answer to Chuck Norris.",
  "Red numbers? Chuck Norris calls those 'motivation'.",
  "Chuck Norris doesn't cut losses. Losses cut themselves.",
  "This would NOT happen if Chuck was your broker.",
  "Chuck Norris roundhouse kicked your portfolio. Unintentionally.",
  "Bears run the market today. Chuck runs the bears.",
  "This loss will be investigated. By Chuck Norris.",
  "Chuck Norris doesn't believe in stop-losses. Stops believe in Chuck.",
  "The market is down. Chuck is on his way.",
  "Chuck Norris once lost a trade. It didn't happen again.",
  "Your portfolio is red. Chuck's patience is wearing thin.",
  "This stock surrendered. Smart move.",
  "Chuck Norris stared at this chart. It flinched.",
  "Losses like this only happen when Chuck isn't watching.",
  "Chuck Norris doesn't panic sell. He calmly destroys the exchange.",
  "Chuck Norris once had a red portfolio. It was the market's last mistake.",
  "This decline fears Chuck more than you do.",
  "Chuck Norris doesn't need a bull market. He IS the bull.",
  "The stock didn't fall. It dropped to avoid Chuck's gaze.",
  "Chuck Norris has already roundhouse kicked the CEO.",
  "Chuck Norris counted to infinity. Twice. Your portfolio can't even count to green.",
];

const CHUCK_GIFS_NEGATIVE = [
  "https://media.tenor.com/3zURMzv9NbsAAAAd/walker-texas-ranger-chuck-norris.gif",
  "https://media.tenor.com/GdF28omU-1YAAAAd/chuck-norris-kick-action.gif",
  "https://media.tenor.com/nJxUQsqEBm0AAAAd/chuck-norris-walker-texas-ranger.gif",
  "https://media.tenor.com/S1wsC7mkb8IAAAAd/chuck-norris-kick.gif",
  "https://media.tenor.com/1XMpa_oblwAAAAAd/punch-chuck-norris.gif",
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
    } else if (funnyMode === "chuck") {
      quoteRef.current = CHUCK_QUOTES_NEGATIVE[Math.floor(Math.random() * CHUCK_QUOTES_NEGATIVE.length)];
      gifRef.current = CHUCK_GIFS_NEGATIVE[Math.floor(Math.random() * CHUCK_GIFS_NEGATIVE.length)];
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
      {show && funnyMode === "chuck" && (
        <span
          className={`trump-popup absolute left-1/2 z-50 pointer-events-none flex items-center gap-1 ${posClass}`}
          style={{ width: 110 }}
        >
          <span className="block bg-gray-800 text-orange-400 text-xs font-semibold rounded-lg px-3 py-2 shadow-xl text-center leading-snug border border-orange-900">
            &ldquo;{quoteRef.current}&rdquo;
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={gifRef.current} alt="Chuck Norris" className="w-24 rounded-xl shadow-2xl" />
        </span>
      )}
    </span>
  );
}
