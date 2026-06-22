"use client";

import { createContext, useContext } from "react";
import { translations, type Language } from "../lib/translations";

export type FunnyMode = "trump" | "cats" | "dogs" | "chuck" | "off";
export type { Language };

interface SettingsCtx {
  funnyMode: FunnyMode;
  language: Language;
}

export const SettingsContext = createContext<SettingsCtx>({ funnyMode: "trump", language: "en" });
export const useSettings = () => useContext(SettingsContext);
export const useTranslation = () => translations[useContext(SettingsContext).language];
