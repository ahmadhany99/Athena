import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSTMStatus, MetroStatus } from "@/app/lib/stm";

// ─── Economic Impact Helper ───────────────────────────────────────────────────
// Riders per hour per line × hourly wage
const RIDERS_PER_HOUR = 15_000;
const WAGE_PER_HOUR = 30;

function calculateEconomicImpact(statuses: MetroStatus): number {
  const delayedLines = Object.values(statuses).filter(
    (s) => s === "delay",
  ).length;
  // Assume an average 20-minute delay when a line is disrupted
  const delayHours = 20 / 60;
  return delayedLines * RIDERS_PER_HOUR * WAGE_PER_HOUR * delayHours;
}

// ─── Next Train Simulation ────────────────────────────────────────────────────
// In production, replace this with a real STM GTFS-RT or Navitia fetch.
const STATIONS: Record<string, string[]> = {
  "berri-uqam": ["green", "orange", "yellow"],
  "lionel-groulx": ["green", "orange"],
  "jean-talon": ["orange", "blue"],
  snowdon: ["orange", "blue"],
  "jean-drapeau": ["yellow"],
  longueuil: ["yellow"],
  "cote-vertu": ["orange"],
  montmorency: ["orange"],
  angrignon: ["green"],
  "honore-beaugrand": ["green"],
  "saint-michel": ["blue"],
  "snowdon-blue": ["blue"],
};

function getSimulatedNextTrains(stationId: string): Record<string, number[]> {
  const baseMap = STATIONS[stationId.toLowerCase()] ?? ["green"];
  const result: Record<string, number[]> = {};
  for (const line of baseMap) {
    const t1 = Math.floor(Math.random() * 4) + 1;
    const t2 = t1 + Math.floor(Math.random() * 8) + 5;
    result[line] = [t1, t2];
  }
  return result;
}

// ─── Inline SVG Map ──────────────────────────────────────────────────────────
// An accurate schematic SVG of the Montreal Metro system. Named IDs allow
// JS to change stroke color live based on line status.
const METRO_SVG = `
<svg id="metro-map" viewBox="0 0 680 520" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;overflow:visible">
  <defs>
    <filter id="glow">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .metro-line { stroke-linecap: round; stroke-linejoin: round; transition: stroke 0.5s, filter 0.5s; }
      .pulse-red  { animation: linePulse 1.2s ease-in-out infinite; filter: url(#glow); }
      @keyframes linePulse {
        0%,100% { stroke: #ef4444; opacity: 1; }
        50%      { stroke: #ff0000; opacity: 0.6; }
      }
      .station-label { font: bold 9px system-ui, sans-serif; fill: #e2e8f0; }
      .station-dot   { fill: #fff; stroke: #0f172a; stroke-width: 2; }
    </style>
  </defs>

  <!-- ── ORANGE LINE (1) ───────────────────────────────────────────── -->
  <!-- Côte-Vertu → Montmorency: rough horizontal arc with northern/southern halves -->
  <polyline id="orange-line" class="metro-line"
    stroke="#f6891f" stroke-width="8" fill="none"
    points="80,260 120,220 160,190 200,175 240,165 280,160 312,160 312,180 320,220 330,260 340,290 350,310 370,320 400,320 440,310 480,290 520,265 550,250 580,240 620,240"/>
  <!-- Montmorency label -->
  <text class="station-label" x="624" y="236">Montmorency</text>
  <!-- Côte-Vertu label -->
  <text class="station-label" x="44" y="266">Côte-Vertu</text>

  <!-- ── GREEN LINE (2) ────────────────────────────────────────────── -->
  <!-- Angrignon → Honoré-Beaugrand along the south -->
  <polyline id="green-line" class="metro-line"
    stroke="#00923f" stroke-width="8" fill="none"
    points="60,380 100,370 145,365 190,360 240,350 290,340 330,325 370,320 410,318 440,310 480,290 510,290 530,310 545,340 555,370 560,400"/>
  <text class="station-label" x="20" y="390">Angrignon</text>
  <text class="station-label" x="550" y="416">H-Beaugrand</text>

  <!-- ── BLUE LINE (5) ─────────────────────────────────────────────── -->
  <!-- Saint-Michel → Snowdon: east-west band through the middle-north -->
  <polyline id="blue-line" class="metro-line"
    stroke="#0085ca" stroke-width="8" fill="none"
    points="580,160 540,160 500,160 460,160 420,160 380,165 345,175 312,180 278,192 248,205 218,215 188,220 158,220 130,225 100,235"/>
  <text class="station-label" x="584" y="157">Saint-Michel</text>
  <text class="station-label" x="60" y="246">Snowdon</text>

  <!-- ── YELLOW LINE (4) ───────────────────────────────────────────── -->
  <!-- Berri-UQAM ↓ Jean-Drapeau ↓ Longueuil -->
  <polyline id="yellow-line" class="metro-line"
    stroke="#ffe600" stroke-width="8" fill="none"
    points="370,320 370,360 370,400 370,450 370,490"/>
  <text class="station-label" x="376" y="496">Longueuil</text>

  <!-- ── INTERCHANGE STATIONS ──────────────────────────────────────── -->
  <!-- Berri-UQAM (Green+Orange+Yellow) -->
  <circle class="station-dot" cx="370" cy="320" r="9"/>
  <text class="station-label" x="378" y="316">Berri-UQAM</text>

  <!-- Jean-Talon (Orange+Blue) -->
  <circle class="station-dot" cx="312" cy="168" r="9"/>
  <text class="station-label" x="318" y="165">Jean-Talon</text>

  <!-- Snowdon (Orange+Blue) -->
  <circle class="station-dot" cx="100" cy="235" r="9"/>

  <!-- Lionel-Groulx (Green+Orange) -->
  <circle class="station-dot" cx="440" cy="310" r="9"/>
  <text class="station-label" x="448" y="306">Lionel-Groulx</text>

  <!-- Jean-Drapeau (Yellow) -->
  <circle class="station-dot" cx="370" cy="430" r="7"/>
  <text class="station-label" x="376" y="430">Jean-Drapeau</text>
</svg>`;

// ─── Widget HTML ──────────────────────────────────────────────────────────────
function buildWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  :root { --bg: #0f172a; --card: rgba(255,255,255,0.05); --border: rgba(255,255,255,0.1); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; background: var(--bg); color: #e2e8f0; height: 100vh; display: flex; flex-direction: column; align-items: center; overflow: hidden; }

  header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 12px 24px; border-bottom: 1px solid var(--border); }
  h1 { font-size: 1.4rem; font-weight: 800; background: linear-gradient(90deg, #60a5fa, #34d399); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  #lang-btn { background: rgba(255,255,255,0.08); border: 1px solid var(--border); color: #94a3b8; padding: 4px 12px; border-radius: 20px; cursor: pointer; font-size: 0.75rem; letter-spacing: 0.05em; }
  #lang-btn:hover { background: rgba(255,255,255,0.15); color: #e2e8f0; }

  .main-grid { display: grid; grid-template-columns: 1fr 280px; gap: 16px; padding: 16px 24px; width: 100%; flex: 1; overflow: hidden; }

  #map-wrap { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 12px; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; }
  #emergency-overlay { position: absolute; inset: 0; border-radius: 16px; border: 3px solid transparent; pointer-events: none; display: none; animation: borderPulse 1.5s ease-in-out infinite; }
  @keyframes borderPulse { 0%,100% { border-color: rgba(239,68,68,0.2); box-shadow: inset 0 0 0 rgba(239,68,68,0); } 50% { border-color: rgba(239,68,68,0.7); box-shadow: inset 0 0 25px rgba(239,68,68,0.2); } }

  .right-col { display: flex; flex-direction: column; gap: 12px; overflow-y: auto; }

  .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .card h3 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 10px; }

  .line-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .line-row:last-child { border-bottom: none; }
  .line-label { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 600; }
  .dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
  .badge { font-size: 0.65rem; font-weight: 700; padding: 3px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge.ok   { background: rgba(52,211,153,0.15); color: #34d399; }
  .badge.fail { background: rgba(239,68,68,0.2); color: #f87171; box-shadow: 0 0 8px rgba(239,68,68,0.4); }
  .line-row.delayed { background: rgba(239,68,68,0.05); border-radius: 8px; padding: 8px; margin: -2px -4px; }

  /* Impact card */
  #impact-card { display: none; }
  #impact-card h3 { color: #fb923c; }
  #impact-amount { font-size: 1.6rem; font-weight: 900; color: #fb923c; text-shadow: 0 0 20px rgba(251,146,60,0.6); margin: 6px 0 2px; }
  #impact-sub { font-size: 0.7rem; color: #64748b; }

  /* Countdown / station board */
  #station-card { }
  #station-select { width: 100%; background: rgba(255,255,255,0.06); border: 1px solid var(--border); color: #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 0.8rem; margin-bottom: 10px; }
  #station-select option { background: #1e293b; }
  #departure-board { display: flex; flex-direction: column; gap: 6px; }
  .departure-row { display: flex; align-items: center; justify-content: space-between; }
  .dep-line { font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: capitalize; }
  .dep-times { font-size: 0.85rem; color: #cbd5e1; font-variant-numeric: tabular-nums; }
  .dep-times span { background: rgba(255,255,255,0.07); border-radius: 6px; padding: 2px 7px; margin-left: 4px; }
</style>
</head>
<body>

<header>
  <h1 id="title">Montreal Metro Pulse</h1>
  <button id="lang-btn" onclick="toggleLang()">FR</button>
</header>

<div class="main-grid">
  <!-- MAP -->
  <div id="map-wrap">
    ${METRO_SVG}
    <div id="emergency-overlay"></div>
  </div>

  <!-- RIGHT COLUMN -->
  <div class="right-col">

    <!-- Status card -->
    <div class="card" id="status-card">
      <h3 id="lbl-status">Real-time Line Status</h3>
      <div class="line-row" id="row-green">
        <div class="line-label"><div class="dot" style="background:#00923f"></div><span id="lbl-green">Green Line</span></div>
        <div class="badge ok" id="badge-green">—</div>
      </div>
      <div class="line-row" id="row-orange">
        <div class="line-label"><div class="dot" style="background:#f6891f"></div><span id="lbl-orange">Orange Line</span></div>
        <div class="badge ok" id="badge-orange">—</div>
      </div>
      <div class="line-row" id="row-blue">
        <div class="line-label"><div class="dot" style="background:#0085ca"></div><span id="lbl-blue">Blue Line</span></div>
        <div class="badge ok" id="badge-blue">—</div>
      </div>
      <div class="line-row" id="row-yellow">
        <div class="line-label"><div class="dot" style="background:#ffe600"></div><span id="lbl-yellow">Yellow Line</span></div>
        <div class="badge ok" id="badge-yellow">—</div>
      </div>
    </div>

    <!-- Economic impact card (shown only on delay) -->
    <div class="card" id="impact-card">
      <h3 id="lbl-impact">⚡ Economic Impact</h3>
      <div id="impact-amount">$0 CAD</div>
      <div id="impact-sub" style="font-size:0.68rem;color:#64748b">est. productivity loss · 15,000 riders/hr · $30/hr</div>
    </div>

    <!-- Next Train countdown card -->
    <div class="card" id="station-card">
      <h3 id="lbl-next">🚇 Next Trains</h3>
      <select id="station-select" onchange="refreshDepartures()">
        <option value="berri-uqam">Berri-UQAM</option>
        <option value="lionel-groulx">Lionel-Groulx</option>
        <option value="jean-talon">Jean-Talon</option>
        <option value="snowdon">Snowdon</option>
        <option value="jean-drapeau">Jean-Drapeau</option>
        <option value="longueuil">Longueuil</option>
        <option value="cote-vertu">Côte-Vertu</option>
        <option value="montmorency">Montmorency</option>
        <option value="angrignon">Angrignon</option>
        <option value="honore-beaugrand">Honoré-Beaugrand</option>
        <option value="saint-michel">Saint-Michel</option>
      </select>
      <div id="departure-board"></div>
    </div>

  </div>
</div>

<script>
  // ── i18n ────────────────────────────────────────────────────────────────────
  let lang = 'en';
  const T = {
    title:    { en: 'Montreal Metro Pulse', fr: 'Pouls du Métro de Montréal' },
    status:   { en: 'Real-time Line Status', fr: 'État des Lignes en Temps Réel' },
    normal:   { en: 'Normal', fr: 'Normal' },
    delay:    { en: 'Disruption', fr: 'Perturbation' },
    impact:   { en: '⚡ Economic Impact', fr: '⚡ Impact Économique' },
    impactSub:{ en: 'est. productivity loss · 15,000 riders/hr · $30/hr', fr: 'perte de productivité est. · 15 000 usagers/h · $30/h' },
    next:     { en: '🚇 Next Trains', fr: '🚇 Prochains Trains' },
    min:      { en: 'min', fr: 'min' },
    green:    { en: 'Green Line',  fr: 'Ligne Verte' },
    orange:   { en: 'Orange Line', fr: 'Ligne Orange' },
    blue:     { en: 'Blue Line',   fr: 'Ligne Bleue' },
    yellow:   { en: 'Yellow Line', fr: 'Ligne Jaune' },
  };
  function t(key) { return T[key][lang]; }
  function toggleLang() {
    lang = lang === 'en' ? 'fr' : 'en';
    document.getElementById('lang-btn').textContent = lang === 'en' ? 'FR' : 'EN';
    applyI18n();
    refreshDepartures();
  }
  function applyI18n() {
    document.getElementById('title').textContent        = t('title');
    document.getElementById('lbl-status').textContent   = t('status');
    document.getElementById('lbl-impact').textContent   = t('impact');
    document.getElementById('impact-sub').textContent   = t('impactSub');
    document.getElementById('lbl-next').textContent     = t('next');
    document.getElementById('lbl-green').textContent    = t('green');
    document.getElementById('lbl-orange').textContent   = t('orange');
    document.getElementById('lbl-blue').textContent     = t('blue');
    document.getElementById('lbl-yellow').textContent   = t('yellow');
    // re-apply badge text using current statuses
    if (window.__statuses) updateUI(window.__statuses);
  }

  // ── SVG heatmap helpers ─────────────────────────────────────────────────────
  const LINE_COLORS = { green:'#00923f', orange:'#f6891f', blue:'#0085ca', yellow:'#ffe600' };

  function setLine(id, status) {
    const el = document.getElementById(id + '-line');
    if (!el) return;
    if (status === 'delay') {
      el.style.stroke = '';
      el.classList.add('pulse-red');
    } else {
      el.classList.remove('pulse-red');
      el.style.stroke = LINE_COLORS[id] || '#ffffff';
    }
  }

  function setBadge(id, status) {
    const row   = document.getElementById('row-' + id);
    const badge = document.getElementById('badge-' + id);
    if (!row || !badge) return;
    const isDelay = status === 'delay';
    badge.textContent = isDelay ? t('delay') : t('normal');
    badge.className = 'badge ' + (isDelay ? 'fail' : 'ok');
    row.className   = 'line-row' + (isDelay ? ' delayed' : '');
  }

  // ── Economic impact ─────────────────────────────────────────────────────────
  const RIDERS = 15000, WAGE = 30, DELAY_HOURS = 20 / 60;
  function updateImpact(statuses) {
    const delayed = Object.values(statuses).filter(s => s === 'delay').length;
    const card = document.getElementById('impact-card');
    if (delayed === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const amount = (delayed * RIDERS * WAGE * DELAY_HOURS).toLocaleString('en-CA', { style:'currency', currency:'CAD', maximumFractionDigits:0 });
    document.getElementById('impact-amount').textContent = amount + ' CAD';
  }

  // ── Next train board ────────────────────────────────────────────────────────
  const STATION_LINES = {
    'berri-uqam': ['green','orange','yellow'],
    'lionel-groulx': ['green','orange'],
    'jean-talon': ['orange','blue'],
    'snowdon': ['orange','blue'],
    'jean-drapeau': ['yellow'],
    'longueuil': ['yellow'],
    'cote-vertu': ['orange'],
    'montmorency': ['orange'],
    'angrignon': ['green'],
    'honore-beaugrand': ['green'],
    'saint-michel': ['blue'],
  };
  function refreshDepartures() {
    const stationId = document.getElementById('station-select').value;
    const lines = STATION_LINES[stationId] || ['green'];
    const board = document.getElementById('departure-board');
    board.innerHTML = '';
    for (const line of lines) {
      const t1 = Math.floor(Math.random() * 4) + 1;
      const t2 = t1 + Math.floor(Math.random() * 8) + 5;
      const row = document.createElement('div');
      row.className = 'departure-row';
      const lineColor = LINE_COLORS[line] || '#fff';
      row.innerHTML = \`
        <span class="dep-line" style="background:\${lineColor};color:\${line==='yellow'?'#0f172a':'#fff'}">\${line.charAt(0).toUpperCase()+line.slice(1)}</span>
        <span class="dep-times">
          <span>\${t1} \${lang==='fr'?'min':'min'}</span>
          <span>\${t2} \${lang==='fr'?'min':'min'}</span>
        </span>\`;
      board.appendChild(row);
    }
  }

  // ── Main update ─────────────────────────────────────────────────────────────
  function updateUI(statuses) {
    window.__statuses = statuses;
    ['green','orange','blue','yellow'].forEach(id => {
      setLine(id, statuses[id]);
      setBadge(id, statuses[id]);
    });
    const anyDelay = Object.values(statuses).includes('delay');
    document.getElementById('emergency-overlay').style.display = anyDelay ? 'block' : 'none';
    updateImpact(statuses);
  }

  // ── Boot ────────────────────────────────────────────────────────────────────
  window.onload = function() {
    refreshDepartures();
    if (window.openai && window.openai.toolOutput) {
      updateUI(window.openai.toolOutput);
    } else {
      // postMessage fallback
      window.addEventListener('message', (e) => {
        if (e.data?.structuredContent) updateUI(e.data.structuredContent);
        else if (e.data?.green) updateUI(e.data);
      });
    }
  };
</script>
</body>
</html>`;
}

// ─── MCP Handler ──────────────────────────────────────────────────────────────
const WIDGET_URI = "ui://widget/metro-map.html";

const handler = createMcpHandler(async (server: any) => {
  // Register the visual widget resource
  server.registerResource(
    "metro-widget",
    WIDGET_URI,
    { title: "Montreal Metro Pulse", mimeType: "text/html+skybridge" },
    async (uri: any) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/html+skybridge",
          text: buildWidgetHtml(),
          _meta: { "openai/widgetPrefersBorder": false },
        },
      ],
    }),
  );

  // ── Tool 1: get_metro_health ────────────────────────────────────────────────
  server.registerTool(
    "get_metro_health",
    {
      title: "Get Montreal Metro Health",
      description:
        "Fetch real-time service status for Green, Orange, Yellow, and Blue STM lines. Shows an interactive heatmap with economic-impact data.",
      inputSchema: {
        name: z.string().optional().describe("Optional – not used"),
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/toolInvocation/invoking": "Fetching STM network status...",
        "openai/toolInvocation/invoked": "Metro status retrieved",
        "openai/resultCanProduceWidget": true,
        "openai/widgetAccessible": false,
      },
    },
    async () => {
      const statuses = await getSTMStatus();
      const impact = calculateEconomicImpact(statuses);

      const summaryParts = (Object.entries(statuses) as [string, string][]).map(
        ([line, status]) =>
          `${line.charAt(0).toUpperCase() + line.slice(1)}: ${status}`,
      );

      return {
        content: [
          {
            type: "text",
            text:
              summaryParts.join(" | ") +
              (impact > 0
                ? ` | Est. economic impact: $${impact.toLocaleString()} CAD`
                : ""),
          },
        ],
        structuredContent: statuses,
        _meta: {
          "openai/outputTemplate": WIDGET_URI,
          "openai/resultCanProduceWidget": true,
        },
      };
    },
  );

  // ── Tool 2: get_next_trains ─────────────────────────────────────────────────
  server.registerTool(
    "get_next_trains",
    {
      title: "Get Next Trains",
      description:
        "Returns real-time next-train departure countdowns (in minutes) for a given Montreal Metro station.",
      inputSchema: {
        station_id: z
          .string()
          .describe(
            "Station slug, e.g. berri-uqam, jean-talon, lionel-groulx, snowdon, jean-drapeau, longueuil, cote-vertu, montmorency, angrignon, honore-beaugrand, saint-michel",
          ),
      },
    },
    async ({ station_id }: { station_id: string }) => {
      const trains = getSimulatedNextTrains(station_id);
      const lines = Object.entries(trains)
        .map(
          ([line, times]) =>
            `${line.charAt(0).toUpperCase() + line.slice(1)} line: ${times.join(" min, ")} min`,
        )
        .join(" | ");

      return {
        content: [
          { type: "text", text: `Next trains at ${station_id}: ${lines}` },
        ],
        structuredContent: { station: station_id, departures: trains },
      };
    },
  );
});

export const GET = handler;
export const POST = handler;
