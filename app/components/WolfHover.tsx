"use client";

import { useState } from "react";
import { useSettings } from "./SettingsContext";

interface Props {
  isPositive: boolean;
  children: React.ReactNode;
}

export default function WolfHover({ isPositive, children }: Props) {
  const { wolfEnabled } = useSettings();
  const [show, setShow] = useState(false);

  return (
    <span
      className="relative"
      onMouseEnter={() => isPositive && wolfEnabled && setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="trump-popup absolute bottom-full left-1/2 mb-2 z-50 pointer-events-none flex flex-col items-center"
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
    </span>
  );
}
