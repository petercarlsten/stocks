"use client";

import { createContext, useContext } from "react";

export type FunnyMode = "trump-wolf" | "cats" | "off";

interface SettingsCtx {
  funnyMode: FunnyMode;
}

export const SettingsContext = createContext<SettingsCtx>({ funnyMode: "trump-wolf" });
export const useSettings = () => useContext(SettingsContext);
