"use client";

import { useState, useEffect } from "react";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";

type Status = "normal" | "delay";
type MetroStatus = {
  orange: Status;
  green: Status;
  yellow: Status;
  blue: Status;
};

export default function Home() {
  const toolOutput = useWidgetProps<{
    name?: string;
    structuredContent?: MetroStatus;
  }>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();
  const isChatGptApp = useIsChatGptApp();

  const [lang, setLang] = useState<"en" | "fr">("en");

  // Attempt to parse structuredContent from the root of the prop
  // Fallback to normal if data hasn't arrived
  const statuses: MetroStatus | null = toolOutput?.structuredContent || null;

  const t = {
    title: { en: "Montreal Metro Pulse", fr: "Le Pouls du Métro de Montréal" },
    subtitle: {
      en: "Real-time Network Status",
      fr: "État du Réseau en Temps Réel",
    },
    normal: { en: "Normal Service", fr: "Service Normal" },
    delay: { en: "Service Disruption", fr: "Perturbation de Service" },
    waiting: {
      en: "Awaiting Network Data...",
      fr: "En attente des données réseau...",
    },
    chatgptWarning: {
      en: "This app relies on data from an AI Agent. No window.openai property detected.",
      fr: "Cette application s'appuie sur un agent d'IA. Aucune propriété window.openai n'est détectée.",
    },
  };

  const hasData = !!statuses;
  const renderStatuses = statuses || {
    orange: "normal" as const,
    green: "normal" as const,
    yellow: "normal" as const,
    blue: "normal" as const,
  };

  return (
    <div
      className="font-sans min-h-screen p-4 sm:p-8 flex flex-col items-center"
      style={{
        maxHeight,
        height: displayMode === "fullscreen" ? maxHeight : undefined,
      }}
    >
      {/* Top Navigation & Controls */}
      <div className="w-full max-w-6xl flex justify-between items-center z-10 mb-8 mt-2">
        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 drop-shadow-sm">
          {t.title[lang]}
        </h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setLang(lang === "en" ? "fr" : "en")}
            className="px-4 py-2 rounded-full glass-panel text-sm font-semibold hover:bg-white/10 transition-colors"
          >
            {lang === "en" ? "FR" : "EN"}
          </button>
          {displayMode !== "fullscreen" && (
            <button
              aria-label="Enter fullscreen"
              className="glass-panel text-foreground shadow-lg p-2.5 hover:bg-white/10 transition-colors cursor-pointer rounded-full"
              onClick={() => requestDisplayMode("fullscreen")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <main className="flex-1 w-full max-w-6xl flex flex-col items-center gap-8 relative">
        {!isChatGptApp && (
          <div className="bg-orange-500/10 border border-orange-500/30 text-orange-400 rounded-lg px-4 py-3 w-full max-w-2xl text-center glass-panel shadow-lg">
            <p className="text-sm font-medium">{t.chatgptWarning[lang]}</p>
          </div>
        )}

        {/* Dashboard Frame */}
        <div className="glass-panel rounded-3xl w-full p-6 sm:p-10 flex flex-col md:flex-row gap-8 items-center shadow-2xl relative overflow-hidden">
          {/* Subtle background glow based on overall status */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-slate-900/50 pointer-events-none" />

          {/* Left panel: Map */}
          <div className="flex-1 w-full flex justify-center items-center relative z-10 p-4">
            {/* 
              Simplified schematic of the Montreal Metro 
              Using dynamic classes to trigger pulse on delay
            */}
            <svg
              viewBox="0 0 400 300"
              className="w-full max-w-lg drop-shadow-xl"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Green Line */}
              <path
                d="M 50 200 L 150 150 L 250 120 L 350 50"
                fill="none"
                stroke={
                  renderStatuses.green === "delay"
                    ? "transparent"
                    : "var(--metro-green)"
                }
                strokeWidth="8"
                className={`line-animate ${renderStatuses.green === "delay" ? "line-pulse" : ""}`}
              />

              {/* Orange Line */}
              <path
                d="M 100 280 L 100 200 L 150 100 L 250 120 L 300 250"
                fill="none"
                stroke={
                  renderStatuses.orange === "delay"
                    ? "transparent"
                    : "var(--metro-orange)"
                }
                strokeWidth="8"
                className={`line-animate ${renderStatuses.orange === "delay" ? "line-pulse" : ""}`}
              />

              {/* Blue Line */}
              <path
                d="M 120 150 L 250 70 L 380 90"
                fill="none"
                stroke={
                  renderStatuses.blue === "delay"
                    ? "transparent"
                    : "var(--metro-blue)"
                }
                strokeWidth="8"
                className={`line-animate ${renderStatuses.blue === "delay" ? "line-pulse" : ""}`}
              />

              {/* Yellow Line */}
              <path
                d="M 250 120 L 280 180 L 350 220"
                fill="none"
                stroke={
                  renderStatuses.yellow === "delay"
                    ? "transparent"
                    : "var(--metro-yellow)"
                }
                strokeWidth="8"
                className={`line-animate ${renderStatuses.yellow === "delay" ? "line-pulse" : ""}`}
              />

              {/* Major Interchange Stations */}
              {/* Lionel-Groulx (Green/Orange) */}
              <circle
                cx="100"
                cy="200"
                r="10"
                fill="#fff"
                stroke="#333"
                strokeWidth="4"
              />
              <text
                x="70"
                y="220"
                fill="currentColor"
                fontSize="12"
                className="font-bold drop-shadow-md"
              >
                Lionel-Groulx
              </text>

              {/* Berri-UQAM (Green/Orange/Yellow) */}
              <circle
                cx="250"
                cy="120"
                r="12"
                fill="#fff"
                stroke="#333"
                strokeWidth="4"
              />
              <text
                x="265"
                y="115"
                fill="currentColor"
                fontSize="12"
                className="font-bold drop-shadow-md"
              >
                Berri-UQAM
              </text>

              {/* Snowdon (Orange/Blue) */}
              <circle
                cx="120"
                cy="150"
                r="10"
                fill="#fff"
                stroke="#333"
                strokeWidth="4"
              />
              <text
                x="60"
                y="145"
                fill="currentColor"
                fontSize="12"
                className="font-bold drop-shadow-md"
              >
                Snowdon
              </text>

              {/* Jean-Talon (Orange/Blue) */}
              <circle
                cx="215"
                cy="85"
                r="10"
                fill="#fff"
                stroke="#333"
                strokeWidth="4"
              />
              <text
                x="180"
                y="70"
                fill="currentColor"
                fontSize="12"
                className="font-bold drop-shadow-md"
              >
                Jean-Talon
              </text>
            </svg>
          </div>

          {/* Right panel: Legend and Status list */}
          <div className="w-full md:w-80 flex flex-col gap-4 z-10">
            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-100 to-slate-400">
              {t.subtitle[lang]}
            </h2>

            {!hasData && (
              <div className="flex items-center gap-3 animate-pulse text-sky-400 font-medium">
                <div className="w-4 h-4 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                {t.waiting[lang]}
              </div>
            )}

            <div className="flex flex-col gap-3 mt-4">
              {[
                {
                  name: { en: "Green Line", fr: "Ligne Verte" },
                  status: renderStatuses.green,
                  color: "bg-[#00874e]",
                  rawName: "green",
                },
                {
                  name: { en: "Orange Line", fr: "Ligne Orange" },
                  status: renderStatuses.orange,
                  color: "bg-[#ef7d00]",
                  rawName: "orange",
                },
                {
                  name: { en: "Blue Line", fr: "Ligne Bleue" },
                  status: renderStatuses.blue,
                  color: "bg-[#0056a3]",
                  rawName: "blue",
                },
                {
                  name: { en: "Yellow Line", fr: "Ligne Jaune" },
                  status: renderStatuses.yellow,
                  color: "bg-[#ffe400]",
                  rawName: "yellow",
                },
              ].map((line, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-xl border border-white/5 transition-all duration-300 ${line.status === "delay" ? "bg-red-500/10 border-red-500/30" : "bg-white/5 hover:bg-white/10"}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-4 h-4 rounded-full shadow-inner ${line.color} ${line.status === "delay" ? "animate-ping" : ""}`}
                    />
                    <span className="font-bold">{line.name[lang]}</span>
                  </div>
                  <span
                    className={`text-xs font-black uppercase tracking-wider px-2 py-1 rounded-md ${line.status === "delay" ? "bg-red-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.8)]" : "bg-emerald-500/20 text-emerald-400"}`}
                  >
                    {line.status === "delay" ? t.delay[lang] : t.normal[lang]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
