"use client";

import { useState } from "react";

interface Props {
  isPositive: boolean;
  children: React.ReactNode;
}

export default function WolfHover({ isPositive, children }: Props) {
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative"
      onMouseEnter={() => isPositive && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="trump-popup absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center"
          style={{ width: 180 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://gifdb.com/images/high/wolf-of-wall-street-midget-hym6j8cpnvanzigo.gif"
            alt="Wolf of Wall Street"
            className="w-44 rounded-xl shadow-2xl"
          />
        </span>
      )}
    </span>
  );
}
