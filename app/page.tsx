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
  const [liveStatuses, setLiveStatuses] = useState<MetroStatus | null>(null);

  useEffect(() => {
    // If the Athena SDK injects payload directly via mcp-handler hook
    if (toolOutput?.structuredContent) {
      setLiveStatuses(toolOutput.structuredContent);
      return;
    }

    // Fallback: Fetch real-time status independently if the webhook/iframe injection fails
    let isMounted = true;
    fetch("/api/status")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) setLiveStatuses(data);
      })
      .catch((err) => console.error("Failed to fetch live STM status:", err));

    return () => {
      isMounted = false;
    };
  }, [toolOutput]);

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

  const hasData = !!liveStatuses;
  const renderStatuses = liveStatuses || {
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
            <div className="relative w-full max-w-lg aspect-square sm:aspect-video rounded-3xl bg-white/5 border border-white/10 p-4 shadow-2xl flex items-center justify-center overflow-hidden">
              {/* High-quality real Montreal Metro Map */}
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/e/ec/Montreal-metro.svg"
                alt="STM Real Metro Map"
                className="w-full h-full object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform duration-700"
              />

              {/* Full-Map Alert Overlay if any lines are disrupted */}
              {(renderStatuses.orange === "delay" ||
                renderStatuses.green === "delay" ||
                renderStatuses.blue === "delay" ||
                renderStatuses.yellow === "delay") && (
                <div className="absolute inset-0 border-4 border-red-500/30 rounded-3xl animate-[pulse-alert_2s_ease-in-out_infinite] mix-blend-screen pointer-events-none shadow-[inset_0_0_30px_rgba(239,68,68,0.2)]" />
              )}
            </div>
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
