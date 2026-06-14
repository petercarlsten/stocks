"use client";

import { createContext, useContext } from "react";

interface SettingsCtx {
  trumpEnabled: boolean;
  wolfEnabled: boolean;
}

export const SettingsContext = createContext<SettingsCtx>({ trumpEnabled: true, wolfEnabled: true });
export const useSettings = () => useContext(SettingsContext);
