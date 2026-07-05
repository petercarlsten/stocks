"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import type { FunnyMode, Language } from "./SettingsContext";
import { useTranslation } from "./SettingsContext";

export const ALL_CURRENCIES = [
  { code: "AED", name: "UAE Dirham" },
  { code: "AFN", name: "Afghan Afghani" },
  { code: "ALL", name: "Albanian Lek" },
  { code: "AMD", name: "Armenian Dram" },
  { code: "ANG", name: "Netherlands Antillean Guilder" },
  { code: "AOA", name: "Angolan Kwanza" },
  { code: "ARS", name: "Argentine Peso" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "AWG", name: "Aruban Florin" },
  { code: "AZN", name: "Azerbaijani Manat" },
  { code: "BAM", name: "Bosnia-Herzegovina Convertible Mark" },
  { code: "BBD", name: "Barbadian Dollar" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "BGN", name: "Bulgarian Lev" },
  { code: "BHD", name: "Bahraini Dinar" },
  { code: "BIF", name: "Burundian Franc" },
  { code: "BMD", name: "Bermudan Dollar" },
  { code: "BND", name: "Brunei Dollar" },
  { code: "BOB", name: "Bolivian Boliviano" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "BSD", name: "Bahamian Dollar" },
  { code: "BTN", name: "Bhutanese Ngultrum" },
  { code: "BWP", name: "Botswanan Pula" },
  { code: "BYN", name: "Belarusian Ruble" },
  { code: "BZD", name: "Belize Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CDF", name: "Congolese Franc" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CLP", name: "Chilean Peso" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "COP", name: "Colombian Peso" },
  { code: "CRC", name: "Costa Rican Colón" },
  { code: "CUP", name: "Cuban Peso" },
  { code: "CVE", name: "Cape Verdean Escudo" },
  { code: "CZK", name: "Czech Koruna" },
  { code: "DJF", name: "Djiboutian Franc" },
  { code: "DKK", name: "Danish Krone" },
  { code: "DOP", name: "Dominican Peso" },
  { code: "DZD", name: "Algerian Dinar" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "ERN", name: "Eritrean Nakfa" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "EUR", name: "Euro" },
  { code: "FJD", name: "Fijian Dollar" },
  { code: "FKP", name: "Falkland Islands Pound" },
  { code: "GBP", name: "British Pound" },
  { code: "GEL", name: "Georgian Lari" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "GIP", name: "Gibraltar Pound" },
  { code: "GMD", name: "Gambian Dalasi" },
  { code: "GNF", name: "Guinean Franc" },
  { code: "GTQ", name: "Guatemalan Quetzal" },
  { code: "GYD", name: "Guyanaese Dollar" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "HNL", name: "Honduran Lempira" },
  { code: "HRK", name: "Croatian Kuna" },
  { code: "HTG", name: "Haitian Gourde" },
  { code: "HUF", name: "Hungarian Forint" },
  { code: "IDR", name: "Indonesian Rupiah" },
  { code: "ILS", name: "Israeli New Shekel" },
  { code: "INR", name: "Indian Rupee" },
  { code: "IQD", name: "Iraqi Dinar" },
  { code: "IRR", name: "Iranian Rial" },
  { code: "ISK", name: "Icelandic Króna" },
  { code: "JMD", name: "Jamaican Dollar" },
  { code: "JOD", name: "Jordanian Dinar" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "KGS", name: "Kyrgystani Som" },
  { code: "KHR", name: "Cambodian Riel" },
  { code: "KMF", name: "Comorian Franc" },
  { code: "KPW", name: "North Korean Won" },
  { code: "KRW", name: "South Korean Won" },
  { code: "KWD", name: "Kuwaiti Dinar" },
  { code: "KYD", name: "Cayman Islands Dollar" },
  { code: "KZT", name: "Kazakhstani Tenge" },
  { code: "LAK", name: "Laotian Kip" },
  { code: "LBP", name: "Lebanese Pound" },
  { code: "LKR", name: "Sri Lankan Rupee" },
  { code: "LRD", name: "Liberian Dollar" },
  { code: "LSL", name: "Lesotho Loti" },
  { code: "LYD", name: "Libyan Dinar" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MDL", name: "Moldovan Leu" },
  { code: "MGA", name: "Malagasy Ariary" },
  { code: "MKD", name: "Macedonian Denar" },
  { code: "MMK", name: "Myanmar Kyat" },
  { code: "MNT", name: "Mongolian Tugrik" },
  { code: "MOP", name: "Macanese Pataca" },
  { code: "MRU", name: "Mauritanian Ouguiya" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "MVR", name: "Maldivian Rufiyaa" },
  { code: "MWK", name: "Malawian Kwacha" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "MZN", name: "Mozambican Metical" },
  { code: "NAD", name: "Namibian Dollar" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "NIO", name: "Nicaraguan Córdoba" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NPR", name: "Nepalese Rupee" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "OMR", name: "Omani Rial" },
  { code: "PAB", name: "Panamanian Balboa" },
  { code: "PEN", name: "Peruvian Sol" },
  { code: "PGK", name: "Papua New Guinean Kina" },
  { code: "PHP", name: "Philippine Peso" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "PYG", name: "Paraguayan Guarani" },
  { code: "QAR", name: "Qatari Rial" },
  { code: "RON", name: "Romanian Leu" },
  { code: "RSD", name: "Serbian Dinar" },
  { code: "RUB", name: "Russian Ruble" },
  { code: "RWF", name: "Rwandan Franc" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "SBD", name: "Solomon Islands Dollar" },
  { code: "SCR", name: "Seychellois Rupee" },
  { code: "SDG", name: "Sudanese Pound" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "SHP", name: "St. Helena Pound" },
  { code: "SLL", name: "Sierra Leonean Leone" },
  { code: "SOS", name: "Somali Shilling" },
  { code: "SRD", name: "Surinamese Dollar" },
  { code: "STN", name: "São Tomé & Príncipe Dobra" },
  { code: "SVC", name: "Salvadoran Colón" },
  { code: "SYP", name: "Syrian Pound" },
  { code: "SZL", name: "Swazi Lilangeni" },
  { code: "THB", name: "Thai Baht" },
  { code: "TJS", name: "Tajikistani Somoni" },
  { code: "TMT", name: "Turkmenistani Manat" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "TOP", name: "Tongan Paʻanga" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "TTD", name: "Trinidad & Tobago Dollar" },
  { code: "TWD", name: "New Taiwan Dollar" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "USD", name: "US Dollar" },
  { code: "UYU", name: "Uruguayan Peso" },
  { code: "UZS", name: "Uzbekistani Som" },
  { code: "VES", name: "Venezuelan Bolívar" },
  { code: "VND", name: "Vietnamese Dong" },
  { code: "VUV", name: "Vanuatu Vatu" },
  { code: "WST", name: "Samoan Tala" },
  { code: "XAF", name: "Central African CFA Franc" },
  { code: "XCD", name: "East Caribbean Dollar" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "XPF", name: "CFP Franc" },
  { code: "YER", name: "Yemeni Rial" },
  { code: "ZAR", name: "South African Rand" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "ZWL", name: "Zimbabwean Dollar" },
];

function Toggle({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="flex items-center justify-between w-full text-sm text-gray-700 hover:text-gray-900"
    >
      <span>{label}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${enabled ? "bg-indigo-600" : "bg-gray-300"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 mt-0.5 ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
    </button>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  theme: "light" | "dark";
  onThemeChange: (v: "light" | "dark") => void;
  funnyMode: FunnyMode;
  onFunnyModeChange: (v: FunnyMode) => void;
  newsEnabled: boolean;
  onNewsChange: (v: boolean) => void;
  leaderboardEnabled: boolean;
  onLeaderboardChange: (v: boolean) => void;
  topGainersEnabled: boolean;
  onTopGainersChange: (v: boolean) => void;
  language: Language;
  onLanguageChange: (v: Language) => void;
  reportEmail: string;
  onReportEmailChange: (email: string) => void;
  emailReports: { monthly?: boolean; yearly?: boolean };
  onEmailReportsChange: (v: { monthly?: boolean; yearly?: boolean }) => void;
  pushEnabled: boolean;
  onPushChange: (v: boolean) => void;
  pushSchedule: { daily?: boolean; monthly?: boolean; yearly?: boolean; earnings?: boolean };
  onPushScheduleChange: (s: { daily?: boolean; monthly?: boolean; yearly?: boolean }) => void;
  drawdownStartDate: string;
  onDrawdownStartDateChange: (v: string) => void;
  drawdownDate: string;
  onDrawdownDateChange: (v: string) => void;
  growthRate: number;
  onGrowthRateChange: (v: number) => void;
  inflationRate: number;
  onInflationRateChange: (v: number) => void;
  chartMonths: number;
  onChartMonthsChange: (v: number) => void;
}

export default function SettingsPanel({ open, onClose, currency, onCurrencyChange, theme, onThemeChange, funnyMode, onFunnyModeChange, newsEnabled, onNewsChange, leaderboardEnabled, onLeaderboardChange, topGainersEnabled, onTopGainersChange, language, onLanguageChange, reportEmail, onReportEmailChange, emailReports, onEmailReportsChange, pushEnabled, onPushChange, pushSchedule, onPushScheduleChange, drawdownStartDate, onDrawdownStartDateChange, drawdownDate, onDrawdownDateChange, growthRate, onGrowthRateChange, inflationRate, onInflationRateChange, chartMonths, onChartMonthsChange }: Props) {
  const t = useTranslation();
  const [sendState, setSendState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [pushTestState, setPushTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [pwState, setPwState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pwError, setPwError] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwOpen, setPwOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Reset query when panel opens
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [query]);

  function select(code: string) {
    onCurrencyChange(code);
    setQuery("");
    setDropdownOpen(false);
    fetch("/api/user/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportCurrency: code }),
    });
  }

  const selected = ALL_CURRENCIES.find((c) => c.code === currency);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" />
      <div
        ref={panelRef}
        className="fixed top-0 right-0 h-full w-72 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
          <h2 className="text-gray-900 font-bold text-lg">{t.settingsTitle}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>

        <div className="flex flex-col gap-6 px-6 py-6 overflow-y-auto flex-1">
          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.displayPortfolioValue}</label>

            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                placeholder={selected ? `${selected.code} – ${selected.name}` : t.searchCurrency}
                onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
                onFocus={() => setDropdownOpen(true)}
                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 placeholder-gray-400"
              />
              {dropdownOpen && (
                <ul className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-56 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <li className="px-3 py-2 text-gray-400 text-sm">{t.noResults}</li>
                  ) : (
                    filtered.map((c) => (
                      <li
                        key={c.code}
                        onMouseDown={() => select(c.code)}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm hover:bg-gray-50 ${c.code === currency ? "text-indigo-600 font-semibold" : "text-gray-900"}`}
                      >
                        <span className="shrink-0 w-10 font-mono">{c.code}</span>
                        <span className="text-gray-500 truncate">{c.name}</span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            <p className="text-gray-600 text-xs">{t.currencyNote}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.theme}</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {(["light", "dark"] as const).map((th) => (
                <button
                  key={th}
                  onClick={() => onThemeChange(th)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    theme === th
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  {th === "light" ? t.light : t.dark}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.chartPeriodLabel}</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {([1, 3, 6, 12] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChartMonthsChange(m)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    chartMonths === m
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  {m}M
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">Funny reactions</label>
            <div className="grid grid-cols-3 rounded-lg overflow-hidden border border-gray-300">
              {([
                ["off", "Off"],
                ["trump", "🎩 Trump"],
                ["cats", "🐱 Cats"],
                ["dogs", "🐶 Dogs"],
                ["chuck", "🥋 Chuck"],
                ["fortune-cat", "🐱 Fortune cat"],
              ] as const).map(([mode, label], i) => (
                <button
                  key={mode}
                  onClick={() => onFunnyModeChange(mode)}
                  className={`py-2 text-sm font-medium transition-colors border-gray-300 ${i < 3 ? "border-b" : ""} ${i % 3 !== 2 ? "border-r" : ""} ${
                    funnyMode === mode
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">Widgets</label>
            <Toggle label={t.stockNews} enabled={newsEnabled} onChange={onNewsChange} />
            <Toggle label={t.gainsSincePurchasedToggle} enabled={leaderboardEnabled} onChange={onLeaderboardChange} />
            <Toggle label={t.topGainers} enabled={topGainersEnabled} onChange={onTopGainersChange} />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.reportEmailLabel}</label>
            <input
              type="email"
              value={reportEmail}
              placeholder={t.reportEmailPlaceholder}
              onChange={(e) => onReportEmailChange(e.target.value)}
              className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 placeholder-gray-400"
            />
            {reportEmail && (
              <div className="flex gap-4">
                {(["monthly", "yearly"] as const).map((freq) => (
                  <label key={freq} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={emailReports[freq] ?? true}
                      onChange={(e) => onEmailReportsChange({ ...emailReports, [freq]: e.target.checked })}
                      className="w-3.5 h-3.5 accent-indigo-600"
                    />
                    <span className="text-xs text-gray-700 capitalize">{freq} report</span>
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-gray-600 text-xs">{t.reportEmailNote}</p>
              <button
                onClick={async () => {
                  if (!reportEmail || sendState === "sending") return;
                  setSendState("sending");
                  try {
                    const res = await fetch("/api/send-report", { method: "POST" });
                    setSendState(res.ok ? "sent" : "error");
                  } catch {
                    setSendState("error");
                  }
                  setTimeout(() => setSendState("idle"), 3000);
                }}
                disabled={!reportEmail || sendState === "sending"}
                className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-2"
              >
                {sendState === "sending" ? t.sending : sendState === "sent" ? t.sent : sendState === "error" ? t.sendError : t.sendReportNow}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">Push notifications</label>
            <div className="flex items-center justify-between">
              <p className="text-gray-600 text-xs">Push notifications on your device</p>
              <button
                onClick={async () => {
                  if (!pushEnabled) {
                    const perm = await Notification.requestPermission();
                    if (perm !== "granted") return;
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.subscribe({
                      userVisibleOnly: true,
                      applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                    });
                    await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub) });
                    onPushChange(true);
                  } else {
                    const reg = await navigator.serviceWorker.ready;
                    const sub = await reg.pushManager.getSubscription();
                    if (sub) await sub.unsubscribe();
                    await fetch("/api/push/subscribe", { method: "DELETE" });
                    onPushChange(false);
                  }
                }}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${pushEnabled ? "bg-indigo-500" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${pushEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>
            {pushEnabled && (
              <div className="flex flex-col gap-2">
                <p className="text-gray-500 text-xs font-medium">Send summary notifications:</p>
                <div className="flex gap-4">
                  {(["daily", "monthly", "yearly", "earnings"] as const).map((freq) => (
                    <label key={freq} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!pushSchedule[freq]}
                        onChange={(e) => onPushScheduleChange({ ...pushSchedule, [freq]: e.target.checked })}
                        className="w-3.5 h-3.5 accent-indigo-600"
                      />
                      <span className="text-xs text-gray-700 capitalize">{freq === "earnings" ? "Earnings calls" : freq}</span>
                    </label>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    if (pushTestState === "sending") return;
                    setPushTestState("sending");
                    try {
                      const res = await fetch("/api/push/test", { method: "POST" });
                      setPushTestState(res.ok ? "sent" : "error");
                    } catch { setPushTestState("error"); }
                    setTimeout(() => setPushTestState("idle"), 3000);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40 self-start"
                  disabled={pushTestState === "sending"}
                >
                  {pushTestState === "sending" ? "Sending…" : pushTestState === "sent" ? "Sent!" : pushTestState === "error" ? "Error" : "Send test notification"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => { setPwOpen((v) => !v); setPwError(""); setPwState("idle"); setCurrentPw(""); setNewPw(""); setConfirmPw(""); }}
              className="flex items-center justify-between text-gray-700 text-sm font-medium"
            >
              <span className="text-gray-700 text-xs font-semibold uppercase tracking-wider">Change password</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${pwOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {pwOpen && (
              <div className="flex flex-col gap-2">
                <input type="password" placeholder="Current password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 placeholder-gray-400" />
                <input type="password" placeholder="New password" value={newPw} onChange={(e) => setNewPw(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 placeholder-gray-400" />
                <input type="password" placeholder="Confirm new password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                  className="w-full bg-gray-50 text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-300 placeholder-gray-400" />
                {pwError && <p className="text-red-500 text-xs">{pwError}</p>}
                <button
                  onClick={async () => {
                    setPwError("");
                    if (!currentPw || !newPw || !confirmPw) { setPwError("All fields required"); return; }
                    if (newPw !== confirmPw) { setPwError("Passwords do not match"); return; }
                    if (newPw.length < 6) { setPwError("Min 6 characters"); return; }
                    setPwState("saving");
                    const res = await fetch("/api/user/password", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
                    });
                    const json = await res.json();
                    if (!res.ok) { setPwError(json.error ?? "Failed"); setPwState("error"); return; }
                    setPwState("saved");
                    setCurrentPw(""); setNewPw(""); setConfirmPw("");
                    setTimeout(() => { setPwState("idle"); setPwOpen(false); }, 2000);
                  }}
                  disabled={pwState === "saving"}
                  className="self-end text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40 font-medium"
                >
                  {pwState === "saving" ? "Saving…" : pwState === "saved" ? "Saved!" : "Save password"}
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.monthlyBudgetSettings}</label>
            <label className="text-gray-500 text-xs">{t.drawdownStartDateLabel}</label>
            <input
              type="date"
              value={drawdownStartDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => onDrawdownStartDateChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label className="text-gray-500 text-xs">{t.drawdownDateLabel}</label>
            <input
              type="date"
              value={drawdownDate}
              min={drawdownStartDate || new Date().toISOString().slice(0, 10)}
              onChange={(e) => onDrawdownDateChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-2">
              <label className="text-gray-500 text-xs shrink-0">{t.expectedGrowth}</label>
              <div className="relative flex items-center ml-auto">
                <input
                  type="number"
                  value={growthRate}
                  min={0}
                  max={50}
                  step={0.5}
                  onChange={(e) => onGrowthRateChange(Math.min(50, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-2 text-gray-400 text-xs pointer-events-none">%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-gray-500 text-xs shrink-0">{t.expectedInflation}</label>
              <div className="relative flex items-center ml-auto">
                <input
                  type="number"
                  value={inflationRate}
                  min={0}
                  max={30}
                  step={0.5}
                  onChange={(e) => onInflationRateChange(Math.min(30, Math.max(0, parseFloat(e.target.value) || 0)))}
                  className="w-16 bg-gray-50 border border-gray-300 rounded-lg px-2 py-1 text-sm text-gray-900 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="absolute right-2 text-gray-400 text-xs pointer-events-none">%</span>
              </div>
            </div>
            <p className="text-gray-400 text-xs">{t.drawdownDateNote}</p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-gray-700 text-xs font-semibold uppercase tracking-wider">{t.language}</label>
            <div className="flex rounded-lg overflow-hidden border border-gray-300">
              {(["en", "sv", "de", "fr"] as const).map((lang) => (
                <button
                  key={lang}
                  onClick={() => onLanguageChange(lang)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    language === lang
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600"
                  }`}
                >
                  {lang === "en" ? "🇬🇧 EN" : lang === "sv" ? "🇸🇪 SV" : lang === "de" ? "🇩🇪 DE" : "🇫🇷 FR"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
