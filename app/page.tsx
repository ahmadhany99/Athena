"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  useWidgetProps,
  useMaxHeight,
  useDisplayMode,
  useRequestDisplayMode,
  useIsChatGptApp,
} from "./hooks";

// ── Types ──────────────────────────────────────────────────────────────────────
type Status = "normal" | "delay";
type MetroStatus = {
  orange: Status;
  green: Status;
  yellow: Status;
  blue: Status;
};
type ToolPayload = {
  structuredContent?:
    | MetroStatus
    | { station?: string; departures?: Record<string, number[]> };
  station?: string;
  departures?: Record<string, number[]>;
  _meta?: { "openai/widgetDomain"?: string };
};

// ── Constants ─────────────────────────────────────────────────────────────────
const LINE_META: Record<
  string,
  { color: string; label: Record<string, string> }
> = {
  orange: {
    color: "#f6891f",
    label: { en: "Orange Line", fr: "Ligne Orange" },
  },
  green: { color: "#00923f", label: { en: "Green Line", fr: "Ligne Verte" } },
  blue: { color: "#0085ca", label: { en: "Blue Line", fr: "Ligne Bleue" } },
  yellow: { color: "#ffe600", label: { en: "Yellow Line", fr: "Ligne Jaune" } },
};
const LINE_RIDERSHIP: Record<string, number> = {
  orange: 18000,
  green: 16000,
  blue: 8000,
  yellow: 5000,
};
const WAGE = 31.5;
const LINES = ["orange", "green", "blue", "yellow"] as const;

const TERMINUS: Record<string, { a: string; b: string }> = {
  orange: { a: "Côte-Vertu", b: "Montmorency" },
  green: { a: "Angrignon", b: "Honoré-Beaugrand" },
  blue: { a: "Snowdon", b: "Saint-Michel" },
  yellow: { a: "Berri-UQAM", b: "Longueuil–U.-de-S." },
};
const TERMINAL_MAP: Record<string, Record<string, "a" | "b">> = {
  "cote-vertu": { orange: "a" },
  montmorency: { orange: "b" },
  angrignon: { green: "a" },
  "honore-beaugrand": { green: "b" },
  snowdon: { blue: "a" },
  "saint-michel": { blue: "b" },
  "berri-uqam": { yellow: "a" },
  longueuil: { yellow: "b" },
};

const ALL_STATIONS: Record<string, { id: string; en: string; fr: string }[]> = {
  orange: [
    { id: "cote-vertu", en: "Côte-Vertu", fr: "Côte-Vertu" },
    { id: "du-college", en: "Du Collège", fr: "Du Collège" },
    { id: "de-la-savane", en: "De la Savane", fr: "De la Savane" },
    { id: "namur", en: "Namur", fr: "Namur" },
    { id: "plamondon", en: "Plamondon", fr: "Plamondon" },
    {
      id: "cote-sainte-catherine",
      en: "Côte-Sainte-Catherine",
      fr: "Côte-Sainte-Catherine",
    },
    { id: "snowdon", en: "Snowdon", fr: "Snowdon" },
    { id: "villa-maria", en: "Villa-Maria", fr: "Villa-Maria" },
    { id: "vendome", en: "Vendôme", fr: "Vendôme" },
    {
      id: "place-saint-henri",
      en: "Place-Saint-Henri",
      fr: "Place-Saint-Henri",
    },
    { id: "lionel-groulx", en: "Lionel-Groulx ★", fr: "Lionel-Groulx ★" },
    { id: "georges-vanier", en: "Georges-Vanier", fr: "Georges-Vanier" },
    { id: "lucien-lallier", en: "Lucien-L'Allier", fr: "Lucien-L'Allier" },
    { id: "bonaventure", en: "Bonaventure", fr: "Bonaventure" },
    {
      id: "square-victoria",
      en: "Square-Victoria–OACI",
      fr: "Square-Victoria–OACI",
    },
    { id: "place-darmes", en: "Place-d'Armes", fr: "Place-d'Armes" },
    { id: "champ-de-mars", en: "Champ-de-Mars", fr: "Champ-de-Mars" },
    { id: "berri-uqam", en: "Berri-UQAM ★", fr: "Berri-UQAM ★" },
    { id: "sherbrooke", en: "Sherbrooke", fr: "Sherbrooke" },
    { id: "mont-royal", en: "Mont-Royal", fr: "Mont-Royal" },
    { id: "laurier", en: "Laurier", fr: "Laurier" },
    { id: "rosemont", en: "Rosemont", fr: "Rosemont" },
    { id: "beaubien", en: "Beaubien", fr: "Beaubien" },
    { id: "jean-talon", en: "Jean-Talon ★", fr: "Jean-Talon ★" },
    { id: "jarry", en: "Jarry", fr: "Jarry" },
    { id: "cremazie", en: "Crémazie", fr: "Crémazie" },
    { id: "sauve", en: "Sauvé", fr: "Sauvé" },
    { id: "henri-bourassa", en: "Henri-Bourassa", fr: "Henri-Bourassa" },
    { id: "cartier", en: "Cartier", fr: "Cartier" },
    { id: "montmorency", en: "Montmorency", fr: "Montmorency" },
  ],
  green: [
    { id: "angrignon", en: "Angrignon", fr: "Angrignon" },
    { id: "monk", en: "Monk", fr: "Monk" },
    { id: "jolicoeur", en: "Jolicoeur", fr: "Jolicoeur" },
    { id: "verdun", en: "Verdun", fr: "Verdun" },
    { id: "de-leglise", en: "De l'Église", fr: "De l'Église" },
    { id: "lasalle", en: "LaSalle", fr: "LaSalle" },
    { id: "charlevoix", en: "Charlevoix", fr: "Charlevoix" },
    { id: "lionel-groulx", en: "Lionel-Groulx ★", fr: "Lionel-Groulx ★" },
    { id: "atwater", en: "Atwater", fr: "Atwater" },
    { id: "guy-concordia", en: "Guy-Concordia", fr: "Guy-Concordia" },
    { id: "peel", en: "Peel", fr: "Peel" },
    { id: "mcgill", en: "McGill", fr: "McGill" },
    { id: "place-des-arts", en: "Place-des-Arts", fr: "Place-des-Arts" },
    { id: "saint-laurent", en: "Saint-Laurent", fr: "Saint-Laurent" },
    { id: "berri-uqam", en: "Berri-UQAM ★", fr: "Berri-UQAM ★" },
    { id: "beaudry", en: "Beaudry", fr: "Beaudry" },
    { id: "papineau", en: "Papineau", fr: "Papineau" },
    { id: "frontenac", en: "Frontenac", fr: "Frontenac" },
    { id: "prefontaine", en: "Préfontaine", fr: "Préfontaine" },
    { id: "joliette", en: "Joliette", fr: "Joliette" },
    { id: "pie-ix", en: "Pie-IX", fr: "Pie-IX" },
    { id: "viau", en: "Viau", fr: "Viau" },
    { id: "assomption", en: "Assomption", fr: "Assomption" },
    { id: "cadillac", en: "Cadillac", fr: "Cadillac" },
    { id: "langelier", en: "Langelier", fr: "Langelier" },
    { id: "radisson", en: "Radisson", fr: "Radisson" },
    { id: "honore-beaugrand", en: "Honoré-Beaugrand", fr: "Honoré-Beaugrand" },
  ],
  yellow: [
    { id: "berri-uqam", en: "Berri-UQAM ★", fr: "Berri-UQAM ★" },
    { id: "jean-drapeau", en: "Jean-Drapeau", fr: "Jean-Drapeau" },
    { id: "longueuil", en: "Longueuil–U.-de-S.", fr: "Longueuil–U.-de-S." },
  ],
  blue: [
    { id: "snowdon", en: "Snowdon ★", fr: "Snowdon ★" },
    { id: "cote-des-neiges", en: "Côte-des-Neiges", fr: "Côte-des-Neiges" },
    {
      id: "universite-de-montreal",
      en: "Université-de-Montréal",
      fr: "Université-de-Montréal",
    },
    {
      id: "edouard-montpetit",
      en: "Édouard-Montpetit",
      fr: "Édouard-Montpetit",
    },
    { id: "outremont", en: "Outremont", fr: "Outremont" },
    { id: "acadie", en: "Acadie", fr: "Acadie" },
    { id: "parc", en: "Parc", fr: "Parc" },
    { id: "de-castelnau", en: "De Castelnau", fr: "De Castelnau" },
    { id: "jean-talon", en: "Jean-Talon ★", fr: "Jean-Talon ★" },
    { id: "fabre", en: "Fabre", fr: "Fabre" },
    { id: "diberville", en: "D'Iberville", fr: "D'Iberville" },
    { id: "saint-michel", en: "Saint-Michel", fr: "Saint-Michel" },
  ],
};

// ── Helper: simulate departures ───────────────────────────────────────────────
function simulateDeps(stationId: string): Record<string, number[]> {
  const deps: Record<string, number[]> = {};
  for (const [line, stations] of Object.entries(ALL_STATIONS)) {
    if (!stations.some((s) => s.id === stationId)) continue;
    const t1 = Math.floor(Math.random() * 5) + 1;
    const t2 = t1 + Math.floor(Math.random() * 7) + 4;
    const t3 = t2 + Math.floor(Math.random() * 6) + 4;
    deps[line] = [t1, t2, t3];
  }
  return deps;
}

// ── DepartureCard ─────────────────────────────────────────────────────────────
function DepartureCard({
  line,
  times,
  direction,
  lang,
}: {
  line: string;
  times: number[];
  direction: "a" | "b" | "both-a" | "both-b";
  lang: string;
}) {
  const meta = LINE_META[line];
  const term = TERMINUS[line] ?? { a: "?", b: "?" };
  const dest = direction === "a" || direction === "both-a" ? term.a : term.b;
  const arrow =
    direction === "both-a" ? "← " : direction === "both-b" ? "→ " : "";
  const toward = lang === "fr" ? "Vers" : "Toward";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            display: "inline-block",
            width: 5,
            height: 22,
            borderRadius: 3,
            background: meta.color,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: ".72rem", color: "#64748b", marginRight: 2 }}>
          {arrow}
          {toward}
        </span>
        <strong style={{ fontSize: ".9rem", color: "#e2e8f0" }}>{dest}</strong>
      </div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" as const }}>
        {times.map((m, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column" as const,
              alignItems: "center",
              background:
                m <= 2 ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.06)",
              border: m <= 2 ? "1px solid rgba(52,211,153,0.3)" : "none",
              borderRadius: 10,
              padding: "8px 12px",
              minWidth: 60,
            }}
          >
            <span
              style={{
                fontSize: "1.6rem",
                fontWeight: 900,
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
                color: m <= 2 ? "#34d399" : "#e2e8f0",
              }}
            >
              {m}
            </span>
            <span
              style={{
                fontSize: ".55rem",
                textTransform: "uppercase" as const,
                color: "#64748b",
              }}
            >
              {lang === "fr" ? "min" : "min"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Home() {
  const toolOutput = useWidgetProps<ToolPayload>();
  const maxHeight = useMaxHeight() ?? undefined;
  const displayMode = useDisplayMode();
  const requestDisplayMode = useRequestDisplayMode();

  const [lang, setLang] = useState<"en" | "fr">("en");
  const [statuses, setStatuses] = useState<MetroStatus>({
    orange: "normal",
    green: "normal",
    blue: "normal",
    yellow: "normal",
  });
  const [delayStart, setDelayStart] = useState<Record<string, number>>({});
  const [impactAmt, setImpactAmt] = useState<Record<string, number>>({});
  const [uptimes, setUptimes] = useState<Record<string, number>>({
    orange: 100,
    green: 100,
    blue: 100,
    yellow: 100,
  });
  const [selectedStation, setSelectedStation] = useState("berri-uqam");
  const [selectedLabel, setSelectedLabel] = useState("Berri-UQAM ★");
  const [departures, setDepartures] = useState<Record<string, number[]>>(
    simulateDeps("berri-uqam"),
  );
  const [searchVal, setSearchVal] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const sessionStart = useRef(Date.now());
  const depTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Pull data from Athena SDK / API ──────────────────────────────────────────
  useEffect(() => {
    const sc = toolOutput?.structuredContent as any;
    if (sc) {
      if (sc.orange !== undefined || sc.green !== undefined) {
        setStatuses(sc as MetroStatus);
      } else if (sc.departures) {
        setDepartures(sc.departures);
      }
      return;
    }
    const domain =
      toolOutput?._meta?.["openai/widgetDomain"] ??
      (typeof window !== "undefined" ? window.location.origin : "");
    if (!domain) return;
    const url = `${domain}/api/status`.replace(/([^:]\/)\//g, "$1/");
    fetch(url)
      .then((r) => r.json())
      .then((d) => setStatuses(d))
      .catch(() => {});
  }, [toolOutput]);

  // ── Economic impact ticker ────────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const sessionMins = (now - sessionStart.current) / 60000;
      const newUptimes: Record<string, number> = {};
      const newImpact: Record<string, number> = {};
      for (const line of LINES) {
        const ds = delayStart[line];
        const delayMins = ds ? (now - ds) / 60000 : 0;
        newUptimes[line] = Math.max(
          0,
          Math.min(100, 100 * (1 - delayMins / Math.max(sessionMins, 1))),
        );
        if (ds) {
          newImpact[line] = Math.round(
            (delayMins / 60) * (LINE_RIDERSHIP[line] ?? 10000) * WAGE,
          );
        }
      }
      setUptimes(newUptimes);
      setImpactAmt(newImpact);
    }, 5000);
    return () => clearInterval(id);
  }, [delayStart]);

  // ── Track delay start times ───────────────────────────────────────────────────
  useEffect(() => {
    setDelayStart((prev) => {
      const next = { ...prev };
      for (const line of LINES) {
        if (statuses[line] === "delay" && !next[line]) next[line] = Date.now();
        if (statuses[line] === "normal") delete next[line];
      }
      return next;
    });
  }, [statuses]);

  // ── Countdown ticker ──────────────────────────────────────────────────────────
  const loadStation = useCallback((id: string, label: string) => {
    setSelectedStation(id);
    setSelectedLabel(label);
    setDepartures(simulateDeps(id));
    setSearchVal("");
    setShowDropdown(false);
    if (depTimer.current) clearInterval(depTimer.current);
    depTimer.current = setInterval(() => {
      setDepartures((prev) => {
        const next: Record<string, number[]> = {};
        for (const [l, times] of Object.entries(prev)) {
          const updated = times.map((m) => m - 1).filter((m) => m > 0);
          const last = updated[updated.length - 1] ?? 5;
          if (updated.length < 3) {
            updated.push(last + Math.floor(Math.random() * 6) + 4);
          }
          next[l] = updated;
        }
        return next;
      });
    }, 60000);
  }, []);

  useEffect(() => {
    loadStation("berri-uqam", "Berri-UQAM ★");
    return () => {
      if (depTimer.current) clearInterval(depTimer.current);
    };
  }, [loadStation]);

  // ── Clock ─────────────────────────────────────────────────────────────────────
  const [clock, setClock] = useState("");
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString(lang === "fr" ? "fr-CA" : "en-CA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lang]);

  // ── Translations ───────────────────────────────────────────────────────────────
  const T: Record<string, Record<string, string>> = {
    title: { en: "Montreal Metro Pulse", fr: "Pouls du Métro de Montréal" },
    health: { en: "Network Health", fr: "Santé du Réseau" },
    dept: { en: "Live Departures", fr: "Départs en Direct" },
    normal: { en: "Normal", fr: "Normal" },
    delay: { en: "Disruption", fr: "Perturbation" },
    uptime: { en: "Session Uptime", fr: "Disponibilité" },
    impact: { en: "Est. Loss", fr: "Perte est." },
    ridership: { en: "Riders/hr", fr: "Voyageurs/h" },
    search: { en: "Search station…", fr: "Rechercher une station…" },
    choose: { en: "Select a station above", fr: "Choisissez une station" },
    noData: { en: "No departure data", fr: "Aucun départ" },
  };
  const tx = (k: string) => T[k]?.[lang] ?? k;

  // ── Filtered stations for dropdown ────────────────────────────────────────────
  const filteredStations = Object.entries(ALL_STATIONS)
    .map(([line, stations]) => ({
      line,
      stations: stations.filter((s) => {
        if (!searchVal) return true;
        const q = searchVal.toLowerCase();
        return s.en.toLowerCase().includes(q) || s.fr.toLowerCase().includes(q);
      }),
    }))
    .filter((g) => g.stations.length > 0);

  // ── Build departure cards for selected station ─────────────────────────────────
  const termConfig = TERMINAL_MAP[selectedStation] ?? {};

  // ── Shared styles ─────────────────────────────────────────────────────────────
  const S = {
    card: {
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 14,
      padding: "14px 16px",
      transition: "background 0.5s, border-color 0.5s",
    } as React.CSSProperties,
    delayCard: {
      background: "rgba(239,68,68,0.07)",
      border: "1px solid rgba(239,68,68,0.35)",
      animation: "cardPulse 2s ease-in-out infinite",
    } as React.CSSProperties,
  };

  return (
    <div
      style={{
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        background: "#060d1a",
        color: "#e2e8f0",
        height: maxHeight ?? "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cardPulse {
          0%,100% { box-shadow: 0 0 0 rgba(239,68,68,0); }
          50%      { box-shadow: 0 0 18px rgba(239,68,68,0.18); }
        }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          flexShrink: 0,
          background: "rgba(6,13,26,0.95)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background:
                "conic-gradient(#00923f 0deg 90deg,#f6891f 90deg 180deg,#0085ca 180deg 270deg,#ffe600 270deg 360deg)",
            }}
          />
          <h1
            style={{
              fontSize: "1.15rem",
              fontWeight: 900,
              margin: 0,
              background: "linear-gradient(90deg,#60a5fa,#34d399)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {tx("title")}
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: ".8rem",
              color: "#64748b",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {clock}
          </span>
          <button
            onClick={() => setLang(lang === "en" ? "fr" : "en")}
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "#94a3b8",
              padding: "3px 12px",
              borderRadius: 20,
              cursor: "pointer",
              fontSize: ".72rem",
            }}
          >
            {lang === "en" ? "FR" : "EN"}
          </button>
          {displayMode !== "fullscreen" && (
            <button
              onClick={() => requestDisplayMode("fullscreen")}
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#94a3b8",
                padding: "4px 8px",
                borderRadius: 20,
                cursor: "pointer",
              }}
              aria-label="Fullscreen"
            >
              ⛶
            </button>
          )}
        </div>
      </header>

      {/* ── Main Grid ───────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1.15fr",
          gap: 12,
          padding: "12px 16px",
          flex: 1,
          overflow: "hidden",
          minHeight: 0,
        }}
      >
        {/* ── LEFT: Network Health ─────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: ".62rem",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: "#64748b",
              marginBottom: 2,
            }}
          >
            {tx("health")}
          </div>
          {LINES.map((id) => {
            const meta = LINE_META[id];
            const isDelay = statuses[id] === "delay";
            return (
              <div
                key={id}
                style={{ ...S.card, ...(isDelay ? S.delayCard : {}) }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      fontWeight: 700,
                      fontSize: ".95rem",
                    }}
                  >
                    <div
                      style={{
                        width: 13,
                        height: 13,
                        borderRadius: "50%",
                        background: meta.color,
                        flexShrink: 0,
                      }}
                    />
                    {meta.label[lang]}
                  </div>
                  <span
                    style={{
                      fontSize: ".65rem",
                      fontWeight: 800,
                      padding: "3px 10px",
                      borderRadius: 20,
                      textTransform: "uppercase",
                      letterSpacing: ".05em",
                      background: isDelay ? "#ef4444" : "rgba(52,211,153,.15)",
                      color: isDelay ? "#fff" : "#34d399",
                      boxShadow: isDelay
                        ? "0 0 10px rgba(239,68,68,.5)"
                        : "none",
                      transition: "background 0.4s, color 0.4s",
                    }}
                  >
                    {isDelay ? tx("delay") : tx("normal")}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 9,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: ".58rem",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: ".07em",
                      }}
                    >
                      {tx("uptime")}
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        marginTop: 2,
                        color: "#34d399",
                      }}
                    >
                      {(uptimes[id] ?? 100).toFixed(1)}%
                    </div>
                  </div>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 9,
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: ".58rem",
                        color: "#64748b",
                        textTransform: "uppercase",
                        letterSpacing: ".07em",
                      }}
                    >
                      {isDelay ? tx("impact") : tx("ridership")}
                    </div>
                    <div
                      style={{
                        fontSize: "1.1rem",
                        fontWeight: 800,
                        marginTop: 2,
                        color: isDelay ? "#fb923c" : "#94a3b8",
                      }}
                    >
                      {isDelay
                        ? `-$${(impactAmt[id] ?? 0).toLocaleString("en-CA", { maximumFractionDigits: 0 })}`
                        : `${(LINE_RIDERSHIP[id] ?? 0).toLocaleString()}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── RIGHT: Departures Board ──────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            minHeight: 0,
          }}
        >
          <div
            style={{
              fontSize: ".62rem",
              textTransform: "uppercase",
              letterSpacing: ".1em",
              color: "#64748b",
              marginBottom: 2,
            }}
          >
            {tx("dept")}
          </div>

          {/* Station search */}
          <div style={{ position: "relative" }}>
            <input
              value={searchVal}
              onChange={(e) => {
                setSearchVal(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder={tx("search")}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.09)",
                color: "#e2e8f0",
                borderRadius: 9,
                padding: "7px 12px",
                fontSize: ".8rem",
                outline: "none",
              }}
            />
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  zIndex: 100,
                  background: "#0f1a2e",
                  border: "1px solid rgba(255,255,255,0.09)",
                  borderRadius: 10,
                  maxHeight: 220,
                  overflowY: "auto",
                  width: "100%",
                  top: "110%",
                  boxShadow: "0 12px 30px rgba(0,0,0,.6)",
                }}
              >
                {filteredStations.map(({ line, stations }) => (
                  <div key={line}>
                    <div
                      style={{
                        padding: "6px 12px 2px",
                        fontSize: ".6rem",
                        textTransform: "uppercase",
                        letterSpacing: ".09em",
                        color: "#64748b",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 9,
                          height: 9,
                          borderRadius: "50%",
                          background: LINE_META[line].color,
                          marginRight: 6,
                        }}
                      />
                      {LINE_META[line].label[lang]}
                    </div>
                    {stations.map((s) => (
                      <div
                        key={s.id}
                        onMouseDown={() =>
                          loadStation(s.id, s[lang as "en" | "fr"] || s.en)
                        }
                        style={{
                          padding: "7px 14px",
                          fontSize: ".82rem",
                          cursor: "pointer",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "rgba(255,255,255,0.07)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <span
                          style={{
                            display: "inline-block",
                            width: 9,
                            height: 9,
                            borderRadius: "50%",
                            background: LINE_META[line].color,
                            marginRight: 7,
                          }}
                        />
                        {s[lang as "en" | "fr"] || s.en}
                      </div>
                    ))}
                  </div>
                ))}
                {filteredStations.length === 0 && (
                  <div
                    style={{
                      padding: "10px 14px",
                      color: "#64748b",
                      fontSize: ".82rem",
                    }}
                  >
                    No results
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected station label */}
          <div style={{ fontSize: ".75rem", color: "#94a3b8", paddingLeft: 2 }}>
            📍 {selectedLabel}
          </div>

          {/* Departure cards */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {Object.entries(departures).length === 0 ? (
              <div
                style={{
                  color: "#64748b",
                  fontSize: ".85rem",
                  textAlign: "center",
                  paddingTop: 30,
                }}
              >
                {tx("noData")}
              </div>
            ) : (
              Object.entries(departures).map(([line, times]) => {
                const termA = termConfig[line] === "a";
                const termB = termConfig[line] === "b";
                if (termA) {
                  return (
                    <DepartureCard
                      key={`${line}-b`}
                      line={line}
                      times={times}
                      direction="b"
                      lang={lang}
                    />
                  );
                } else if (termB) {
                  return (
                    <DepartureCard
                      key={`${line}-a`}
                      line={line}
                      times={times}
                      direction="a"
                      lang={lang}
                    />
                  );
                } else {
                  const offset = Math.floor(Math.random() * 3) + 2;
                  const towardA = times.map((m) => Math.max(1, m + offset - 1));
                  return (
                    <div key={line}>
                      <DepartureCard
                        line={line}
                        times={times}
                        direction="both-b"
                        lang={lang}
                      />
                      <DepartureCard
                        line={line}
                        times={towardA}
                        direction="both-a"
                        lang={lang}
                      />
                    </div>
                  );
                }
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
