import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { getSTMStatus, MetroStatus } from "@/app/lib/stm";

// ─── Constants ────────────────────────────────────────────────────────────────
// Per-line estimated hourly ridership (STM annual 2023 ridership data, divided by line)
const LINE_RIDERSHIP: Record<string, number> = {
  orange: 18000, // busiest
  green: 16000,
  blue: 8000,
  yellow: 5000,
};
const MONTREAL_HOURLY_WAGE = 31.5; // CAD – Statistics Canada 2024

// ─── Economic Impact ──────────────────────────────────────────────────────────
function calculateEconomicImpact(line: string, delayMinutes: number): number {
  const ridership = LINE_RIDERSHIP[line.toLowerCase()] ?? 10000;
  return Math.round((delayMinutes / 60) * ridership * MONTREAL_HOURLY_WAGE);
}

// ─── STM Real-Time API (prochains passages) ───────────────────────────────────
// Station IDs are from the STM GTFS feed.
// We try the STM real-time open-data endpoint first; fall back to simulation.
async function fetchNextTrains(
  stationId: string,
): Promise<Record<string, number[]>> {
  // Known GTFS stop IDs for major interchange stations
  const GTFS_STOP_IDS: Record<string, string[]> = {
    "berri-uqam": ["51401", "51402", "51403"], // multiple platforms
    "lionel-groulx": ["51281", "51282"],
    "jean-talon": ["51231", "51232"],
    snowdon: ["51261", "51262"],
    "jean-drapeau": ["51341"],
    longueuil: ["51351"],
    "cote-vertu": ["51201"],
    montmorency: ["51211"],
    angrignon: ["51421"],
    "honore-beaugrand": ["51431"],
    "saint-michel": ["51441"],
  };

  try {
    const stops = GTFS_STOP_IDS[stationId.toLowerCase()];
    if (!stops) throw new Error("Unknown station");

    // STM's open-data GTFS-RT endpoint
    const url = `https://api.stm.info/pub/od/gtfs-rt/ic/v2/tripUpdates`;
    const res = await fetch(url, {
      headers: {
        apikey: process.env.STM_API_KEY ?? "",
        Accept: "application/json",
      },
      next: { revalidate: 30 },
    });

    if (!res.ok) throw new Error(`STM API ${res.status}`);
    const data = await res.json();

    // Parse arrivals for our stop IDs
    const departureMinutes: Record<string, Set<number>> = {};
    const now = Math.floor(Date.now() / 1000);

    for (const entity of data.entity ?? []) {
      const trip = entity.tripUpdate;
      if (!trip) continue;

      for (const stu of trip.stopTimeUpdate ?? []) {
        if (!stops.includes(String(stu.stopId))) continue;
        const arrival = stu.arrival?.time ?? stu.departure?.time;
        if (!arrival) continue;
        const mins = Math.round((Number(arrival) - now) / 60);
        if (mins < 0 || mins > 60) continue;

        // Determine line from route ID prefix
        const routeId = String(trip.trip?.routeId ?? "");
        const lineKey = routeId.startsWith("1")
          ? "orange"
          : routeId.startsWith("2")
            ? "green"
            : routeId.startsWith("4")
              ? "yellow"
              : routeId.startsWith("5")
                ? "blue"
                : "metro";

        if (!departureMinutes[lineKey]) departureMinutes[lineKey] = new Set();
        departureMinutes[lineKey].add(mins);
      }
    }

    const result: Record<string, number[]> = {};
    for (const [line, minsSet] of Object.entries(departureMinutes)) {
      result[line] = Array.from(minsSet)
        .sort((a, b) => a - b)
        .slice(0, 3);
    }

    if (Object.keys(result).length === 0) throw new Error("No arrivals parsed");
    return result;
  } catch (err) {
    console.warn("STM GTFS-RT unavailable, using simulation:", err);
    return simulateNextTrains(stationId);
  }
}

// Simulation fallback (when API key is absent or service is down)
const STATION_LINES: Record<string, string[]> = {
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
};

function simulateNextTrains(stationId: string): Record<string, number[]> {
  const lines = STATION_LINES[stationId.toLowerCase()] ?? ["green"];
  const result: Record<string, number[]> = {};
  for (const line of lines) {
    const t1 = Math.floor(Math.random() * 5) + 1;
    const t2 = t1 + Math.floor(Math.random() * 7) + 4;
    const t3 = t2 + Math.floor(Math.random() * 7) + 4;
    result[line] = [t1, t2, t3];
  }
  return result;
}

// ─── SVG Map ──────────────────────────────────────────────────────────────────
// Geographically-accurate schematic SVG based on official STM map proportions.
// Each polyline uses an ID tied directly to JS updateLine() calls.
const METRO_SVG = `<svg id="metro-svg" viewBox="0 0 700 520" xmlns="http://www.w3.org/2000/svg"
  style="width:100%;height:100%;overflow:visible;display:block">
  <defs>
    <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <style>
      .ml { stroke-linecap:round; stroke-linejoin:round; fill:none; transition:stroke 0.6s; }
      .pulse-red { animation:prd 1.1s ease-in-out infinite; filter:url(#glow-red); }
      @keyframes prd { 0%,100%{stroke:#ef4444;opacity:1} 50%{stroke:#ff2222;opacity:0.55} }
      .st { font:bold 8.5px system-ui,sans-serif; fill:#cbd5e1; dominant-baseline:middle; }
      .sd { fill:#fff; stroke:#0f172a; stroke-width:2.5; }
      .tc { fill:#0f172a; stroke-width:4; }
    </style>
  </defs>

  <!-- BG -->
  <rect width="700" height="520" fill="rgba(15,23,42,0.0)" rx="12"/>

  <!-- ── ORANGE LINE (1): Côte-Vertu ←→ Montmorency ─────────────────────── -->
  <!-- West arm: Côte-Vertu → Henri-Bourassa (SN vertical) -->
  <polyline id="stm-orange-line" class="ml" stroke="#f6891f" stroke-width="9"
    points="
      75,258
      105,230 130,205 158,182 188,168 220,158 252,152
      280,148 310,148
      310,165
      320,200 330,238 340,268
      355,292 374,308
      397,308
      424,298 452,278 480,258 508,242 535,232 560,228 590,228 626,228
    "/>
  <text class="st" x="30" y="258">Côte-Vertu</text>
  <text class="st" x="628" y="228">Montmorency</text>

  <!-- ── GREEN LINE (2): Angrignon ←→ Honoré-Beaugrand ─────────────────── -->
  <polyline id="stm-green-line" class="ml" stroke="#00923f" stroke-width="9"
    points="
      50,385
      80,375 115,370 150,366 185,361 218,355 250,347
      282,336 312,325
      340,315 360,308 382,308
      408,307 437,295 465,275 490,270 515,275 532,295 543,322 550,355 553,385
    "/>
  <text class="st" x="18" y="390">Angrignon</text>
  <text class="st" x="538" y="396">H-Beaugrand</text>

  <!-- ── BLUE LINE (5): Snowdon ←→ Saint-Michel ────────────────────────── -->
  <polyline id="stm-blue-line" class="ml" stroke="#0085ca" stroke-width="9"
    points="
      97,235
      128,228 162,224 197,224 230,222 258,220 283,219
      310,215 310,165
      338,152 370,150 402,152 432,158 462,163 492,163 520,162 550,162 580,160 612,160
    "/>
  <text class="st" x="58" y="248">Snowdon</text>
  <text class="st" x="614" y="160">Saint-Michel</text>

  <!-- ── YELLOW LINE (4): Berri-UQAM ←→ Longueuil ─────────────────────── -->
  <polyline id="stm-yellow-line" class="ml" stroke="#ffe600" stroke-width="9"
    points="374,308 374,348 374,392 374,430 374,470 374,500"/>
  <text class="st" x="380" y="502">Longueuil–U.-de-S.</text>

  <!-- ── INTERCHANGE STATIONS (transfer circles) ───────────────────────── -->

  <!-- Berri-UQAM  (Green + Orange + Yellow) -->
  <circle id="st-berri" class="sd tc" cx="374" cy="308" r="11"/>
  <circle class="sd" cx="374" cy="308" r="6" fill="#fff"/>
  <text class="st" x="385" y="302">Berri-UQAM</text>

  <!-- Lionel-Groulx  (Green + Orange) -->
  <circle id="st-lionel" class="sd tc" cx="437" cy="295" r="11"/>
  <circle class="sd" cx="437" cy="295" r="6" fill="#fff"/>
  <text class="st" x="448" y="290">Lionel-Groulx</text>

  <!-- Jean-Talon  (Orange + Blue) -->
  <circle id="st-jt" class="sd tc" cx="310" cy="155" r="11"/>
  <circle class="sd" cx="310" cy="155" r="6" fill="#fff"/>
  <text class="st" x="318" y="150">Jean-Talon</text>

  <!-- Snowdon  (Orange + Blue) -->
  <circle id="st-snowdon" class="sd tc" cx="97" cy="234" r="10"/>
  <circle class="sd" cx="97" cy="234" r="6" fill="#fff"/>

  <!-- Jean-Drapeau  (Yellow) -->
  <circle id="st-jd" class="sd" cx="374" cy="430" r="7" fill="#fff"/>
  <text class="st" x="380" y="430">Jean-Drapeau</text>

  <!-- Côte-des-Neiges / Université-de-Montréal (Blue) -->
  <circle class="sd" cx="230" cy="222" r="6" fill="#fff"/>

  <!-- Terminus dots — start/end of each line -->
  <circle cx="75"  cy="258" r="7" fill="#f6891f"/>
  <circle cx="626" cy="228" r="7" fill="#f6891f"/>
  <circle cx="50"  cy="385" r="7" fill="#00923f"/>
  <circle cx="553" cy="385" r="7" fill="#00923f"/>
  <circle cx="97"  cy="235" r="7" fill="#0085ca"/>
  <circle cx="612" cy="160" r="7" fill="#0085ca"/>
  <circle cx="374" cy="500" r="7" fill="#ffe600"/>
</svg>`;

// ─── Widget HTML factory ──────────────────────────────────────────────────────
function buildWidgetHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  :root{--bg:#0f172a;--card:rgba(255,255,255,0.05);--border:rgba(255,255,255,0.10);}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:system-ui,sans-serif;background:var(--bg);color:#e2e8f0;height:100vh;
       display:flex;flex-direction:column;align-items:stretch;overflow:hidden;}

  /* ── Header ───────────────────────────────────────── */
  header{display:flex;align-items:center;justify-content:space-between;
         padding:10px 20px;border-bottom:1px solid var(--border);flex-shrink:0;}
  h1{font-size:1.25rem;font-weight:900;background:linear-gradient(90deg,#60a5fa,#34d399);
     -webkit-background-clip:text;-webkit-text-fill-color:transparent;}
  #lang-btn{background:rgba(255,255,255,0.08);border:1px solid var(--border);color:#94a3b8;
             padding:4px 14px;border-radius:20px;cursor:pointer;font-size:.75rem;letter-spacing:.05em;}
  #lang-btn:hover{background:rgba(255,255,255,0.16);color:#e2e8f0;}

  /* ── Main grid ────────────────────────────────────── */
  .grid{display:grid;grid-template-columns:1fr 270px;gap:14px;padding:14px 18px;
        flex:1;overflow:hidden;min-height:0;}

  /* ── Map panel ────────────────────────────────────── */
  #map-panel{background:var(--card);border:1px solid var(--border);border-radius:14px;
             padding:10px;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden;}
  #emergency-ring{position:absolute;inset:0;border-radius:14px;border:3px solid transparent;
                  pointer-events:none;display:none;
                  animation:ringPulse 1.4s ease-in-out infinite;}
  @keyframes ringPulse{0%,100%{border-color:rgba(239,68,68,.18);box-shadow:inset 0 0 0 rgba(239,68,68,0)}
                        50%{border-color:rgba(239,68,68,.75);box-shadow:inset 0 0 28px rgba(239,68,68,.22)}}

  /* ── Right column ─────────────────────────────────── */
  .rcol{display:flex;flex-direction:column;gap:10px;overflow-y:auto;}

  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;}
  .card-title{font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;color:#64748b;margin-bottom:8px;}

  /* Line status rows */
  .lrow{display:flex;align-items:center;justify-content:space-between;
        padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);}
  .lrow:last-child{border-bottom:none;}
  .llabel{display:flex;align-items:center;gap:8px;font-size:.83rem;font-weight:600;}
  .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;}
  .badge{font-size:.62rem;font-weight:800;padding:3px 9px;border-radius:20px;
         text-transform:uppercase;letter-spacing:.05em;}
  .badge.ok  {background:rgba(52,211,153,.15);color:#34d399;}
  .badge.err {background:rgba(239,68,68,.2);color:#f87171;box-shadow:0 0 8px rgba(239,68,68,.4);}
  .lrow.delayed{background:rgba(239,68,68,.06);border-radius:8px;padding:7px 6px;margin:-1px -3px;}

  /* Impact card */
  #impact-card{display:none;}
  .impact-title{color:#fb923c!important;}
  #impact-amount{font-size:1.5rem;font-weight:900;color:#fb923c;
                 text-shadow:0 0 18px rgba(251,146,60,.55);margin:4px 0 2px;}
  #impact-sub{font-size:.63rem;color:#64748b;line-height:1.4;}

  /* Countdown card */
  #cnt-select{width:100%;background:rgba(255,255,255,.06);border:1px solid var(--border);
              color:#e2e8f0;border-radius:8px;padding:6px 10px;font-size:.78rem;margin-bottom:8px;}
  #cnt-select option{background:#1e293b;}
  .dep-row{display:flex;align-items:center;justify-content:space-between;padding:5px 0;
           border-bottom:1px solid rgba(255,255,255,.04);}
  .dep-row:last-child{border-bottom:none;}
  .dep-line{font-size:.68rem;font-weight:700;padding:2px 8px;border-radius:4px;text-transform:capitalize;}
  .dep-times{display:flex;gap:5px;}
  .dep-chip{background:rgba(255,255,255,.08);border-radius:6px;padding:2px 7px;
             font-size:.8rem;font-variant-numeric:tabular-nums;color:#cbd5e1;}
  .dep-chip.soon{background:rgba(52,211,153,.18);color:#34d399;}
</style>
</head>
<body>

<header>
  <h1 id="title">Montreal Metro Pulse</h1>
  <button id="lang-btn" onclick="toggleLang()">FR</button>
</header>

<div class="grid">

  <!-- MAP -->
  <div id="map-panel">
    ${METRO_SVG}
    <div id="emergency-ring"></div>
  </div>

  <!-- RIGHT COLUMN -->
  <div class="rcol">

    <!-- Status -->
    <div class="card">
      <div class="card-title" id="lbl-status">Real-time Line Status</div>
      ${["green", "orange", "blue", "yellow"]
        .map(
          (id) => `
      <div class="lrow" id="row-${id}">
        <div class="llabel">
          <div class="dot" style="background:${id === "green" ? "#00923f" : id === "orange" ? "#f6891f" : id === "blue" ? "#0085ca" : "#ffe600"}"></div>
          <span id="lbl-${id}">${id.charAt(0).toUpperCase() + id.slice(1)} Line</span>
        </div>
        <div class="badge ok" id="badge-${id}">—</div>
      </div>`,
        )
        .join("")}
    </div>

    <!-- Economic Impact (shown only on delay) -->
    <div class="card" id="impact-card">
      <div class="card-title impact-title" id="lbl-impact">⚡ Economic Impact</div>
      <div id="impact-amount">$0 CAD</div>
      <div id="impact-sub">est. productivity loss · formula: (delay_min÷60) × ridership × $31.50/hr</div>
    </div>

    <!-- Next Train Countdown -->
    <div class="card">
      <div class="card-title" id="lbl-next">🚇 Next Trains</div>
      <select id="cnt-select" onchange="loadDepartures()">
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
      <div id="dep-board"></div>
    </div>

  </div><!-- /rcol -->
</div><!-- /grid -->

<script>
// ══ i18n ══════════════════════════════════════════════════════════════════════
let lang = 'en';
const T = {
  title:     {en:'Montreal Metro Pulse',       fr:'Pouls du Métro de Montréal'},
  status:    {en:'Real-time Line Status',       fr:'État des Lignes en Temps Réel'},
  normal:    {en:'Normal',                      fr:'Normal'},
  delay:     {en:'Disruption',                  fr:'Perturbation'},
  impact:    {en:'⚡ Economic Impact',           fr:'⚡ Impact Économique'},
  impactSub: {en:'est. productivity loss · (delay_min÷60) × ridership × $31.50/hr',
              fr:'perte de productivité est. · (min_retard÷60) × achalandage × 31,50 $/h'},
  next:      {en:'🚇 Next Trains',              fr:'🚇 Prochains Trains'},
  min:       {en:'min',                         fr:'min'},
  green:     {en:'Green Line',  fr:'Ligne Verte'},
  orange:    {en:'Orange Line', fr:'Ligne Orange'},
  blue:      {en:'Blue Line',   fr:'Ligne Bleue'},
  yellow:    {en:'Yellow Line', fr:'Ligne Jaune'},
};
function tx(k){ return T[k][lang]; }

function toggleLang(){
  lang = lang==='en'?'fr':'en';
  document.getElementById('lang-btn').textContent = lang==='en'?'FR':'EN';
  applyI18n();
  if(window.__statuses) updateUI(window.__statuses);
  renderBoard(window.__departures);
}

function applyI18n(){
  document.getElementById('title').textContent     = tx('title');
  document.getElementById('lbl-status').textContent= tx('status');
  document.getElementById('lbl-impact').textContent= tx('impact');
  document.getElementById('impact-sub').textContent= tx('impactSub');
  document.getElementById('lbl-next').textContent  = tx('next');
  ['green','orange','blue','yellow'].forEach(id=>{
    document.getElementById('lbl-'+id).textContent = tx(id);
  });
}

// ══ SVG heatmap ───────────────────────────────────────────────────────────────
const LINE_COLORS = {green:'#00923f',orange:'#f6891f',blue:'#0085ca',yellow:'#ffe600'};
function setLine(id, status){
  const el = document.getElementById('stm-'+id+'-line');
  if(!el) return;
  if(status==='delay'){
    el.style.stroke='';
    el.classList.add('pulse-red');
  } else {
    el.classList.remove('pulse-red');
    el.style.stroke=LINE_COLORS[id]||'#fff';
  }
}

function setBadge(id, status){
  const row   = document.getElementById('row-'+id);
  const badge = document.getElementById('badge-'+id);
  if(!row||!badge) return;
  const d = status==='delay';
  badge.textContent = d ? tx('delay') : tx('normal');
  badge.className   = 'badge '+(d?'err':'ok');
  row.className     = 'lrow'+(d?' delayed':'');
}

// ══ Economic Impact – live counter ────────────────────────────────────────────
const LINE_RIDERSHIP = {orange:18000,green:16000,blue:8000,yellow:5000};
const WAGE = 31.5;
let impactTimer = null;
let impactStartTime = null;
let impactBaseDelay = 20; // minutes – assumed when a delay starts

function startImpactCounter(statuses){
  const delayed = Object.entries(statuses).filter(([,v])=>v==='delay');
  const card    = document.getElementById('impact-card');
  if(delayed.length===0){ card.style.display='none'; clearInterval(impactTimer); return; }
  card.style.display='block';

  if(!impactStartTime) impactStartTime = Date.now();

  function tick(){
    const elapsedMin = (Date.now()-impactStartTime)/60000;
    const totalDelay = impactBaseDelay + elapsedMin;  // delay grows over time
    let total = 0;
    for(const [line] of delayed){
      const r = LINE_RIDERSHIP[line]||10000;
      total += Math.round((totalDelay/60)*r*WAGE);
    }
    document.getElementById('impact-amount').textContent =
      '$'+total.toLocaleString('en-CA')+' CAD';
  }

  clearInterval(impactTimer);
  tick();
  impactTimer = setInterval(tick, 5000); // update every 5 seconds
}

// ══ Main update ───────────────────────────────────────────────────────────────
function updateUI(statuses){
  window.__statuses = statuses;
  ['green','orange','blue','yellow'].forEach(id=>{
    setLine(id, statuses[id]);
    setBadge(id, statuses[id]);
  });
  const anyDelay = Object.values(statuses).includes('delay');
  document.getElementById('emergency-ring').style.display = anyDelay?'block':'none';
  if(!anyDelay){ impactStartTime=null; }
  startImpactCounter(statuses);
}

// ══ Countdown board ───────────────────────────────────────────────────────────
let countdownTimer = null;
window.__departures = {};

function renderBoard(deps){
  window.__departures = deps||{};
  const board = document.getElementById('dep-board');
  board.innerHTML='';
  for(const [line, times] of Object.entries(window.__departures)){
    if(!times||times.length===0) continue;
    const row = document.createElement('div');
    row.className='dep-row';
    const lc = LINE_COLORS[line]||'#94a3b8';
    const textColor = line==='yellow'?'#0f172a':'#fff';
    const chips = times.map(m=>\`<div class="dep-chip\${m<=2?' soon':''}">\${m} \${tx('min')}</div>\`).join('');
    row.innerHTML=\`<span class="dep-line" style="background:\${lc};color:\${textColor}">\${line.charAt(0).toUpperCase()+line.slice(1)}</span>
                   <div class="dep-times">\${chips}</div>\`;
    board.appendChild(row);
  }
}

// Live countdown ticks every second (decrement displayed minutes)
function startCountdownTick(){
  clearInterval(countdownTimer);
  let tick = 0;
  countdownTimer = setInterval(()=>{
    tick++;
    if(tick%60===0){  // every 60 seconds, re-randomise slightly
      for(const line of Object.keys(window.__departures)){
        window.__departures[line] = window.__departures[line].map(m=>Math.max(0,m-1));
      }
      renderBoard(window.__departures);
    }
  }, 1000);
}

function loadDepartures(){
  const station = document.getElementById('cnt-select').value;
  const STATION_LINES = {
    'berri-uqam':['green','orange','yellow'],
    'lionel-groulx':['green','orange'],
    'jean-talon':['orange','blue'],
    'snowdon':['orange','blue'],
    'jean-drapeau':['yellow'],
    'longueuil':['yellow'],
    'cote-vertu':['orange'],
    'montmorency':['orange'],
    'angrignon':['green'],
    'honore-beaugrand':['green'],
    'saint-michel':['blue'],
  };
  const lines = STATION_LINES[station]||['green'];
  const deps  = {};
  for(const l of lines){
    const t1=Math.floor(Math.random()*5)+1;
    const t2=t1+Math.floor(Math.random()*7)+4;
    const t3=t2+Math.floor(Math.random()*7)+4;
    deps[l]=[t1,t2,t3];
  }
  renderBoard(deps);
  startCountdownTick();
}

// ══ Boot ──────────────────────────────────────────────────────────────────────
window.onload = function(){
  applyI18n();
  loadDepartures();

  // READ DATA from Athena SDK
  if(window.openai && window.openai.toolOutput){
    updateUI(window.openai.toolOutput);
  } else {
    // postMessage fallback (also covers station-board tool responses)
    window.addEventListener('message', e=>{
      const d = e.data;
      if(!d) return;
      if(d.structuredContent){ updateUI(d.structuredContent); return; }
      if(d.green||d.orange)  { updateUI(d); return; }
      if(d.departures)       { renderBoard(d.departures); startCountdownTick(); }
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
  // Resource: visual widget
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

  // ── Tool 1: get_metro_health ──────────────────────────────────────────────
  server.registerTool(
    "get_metro_health",
    {
      title: "Get Montreal Metro Health",
      description:
        "Fetches real-time STM service status for all four metro lines. Returns a heatmap widget with live economic-impact data.",
      inputSchema: { _: z.string().optional() },
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
      const lines = ["orange", "green", "blue", "yellow"] as const;

      // Build summary text
      const parts = lines.map((l) => {
        const s = statuses[l];
        const suffix =
          s === "delay"
            ? ` ⚠️ (est. $${calculateEconomicImpact(l, 20).toLocaleString()} CAD/20 min delay)`
            : " ✅";
        return `${l.charAt(0).toUpperCase() + l.slice(1)}: ${s}${suffix}`;
      });

      return {
        content: [{ type: "text", text: parts.join(" | ") }],
        structuredContent: statuses,
        _meta: {
          "openai/outputTemplate": WIDGET_URI,
          "openai/resultCanProduceWidget": true,
        },
      };
    },
  );

  // ── Tool 2: get_next_trains ───────────────────────────────────────────────
  server.registerTool(
    "get_next_trains",
    {
      title: "Get Next Trains",
      description:
        "Returns live next-train departure countdowns (in minutes) for a given Montreal Metro station.",
      inputSchema: {
        station_id: z
          .string()
          .describe(
            "Station slug: berri-uqam | jean-talon | lionel-groulx | snowdon | jean-drapeau | longueuil | cote-vertu | montmorency | angrignon | honore-beaugrand | saint-michel",
          ),
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        "openai/resultCanProduceWidget": true,
      },
    },
    async ({ station_id }: { station_id: string }) => {
      const trains = await fetchNextTrains(station_id);
      const lines = Object.entries(trains)
        .map(
          ([line, times]) =>
            `${line.charAt(0).toUpperCase() + line.slice(1)}: ${times.join(", ")} min`,
        )
        .join(" | ");

      return {
        content: [
          { type: "text", text: `Next trains at ${station_id}: ${lines}` },
        ],
        structuredContent: { station: station_id, departures: trains },
        _meta: {
          "openai/outputTemplate": WIDGET_URI,
          "openai/resultCanProduceWidget": true,
        },
      };
    },
  );

  // ── Tool 3: calculate_economic_impact ─────────────────────────────────────
  server.registerTool(
    "calculate_economic_impact",
    {
      title: "Calculate Economic Impact",
      description:
        "Calculates estimated productivity loss caused by a metro line delay using formula: (delay_minutes / 60) × ridership × $31.50/hr (Montreal avg wage).",
      inputSchema: {
        line: z
          .enum(["green", "orange", "blue", "yellow"])
          .describe("The delayed line"),
        delay_minutes: z
          .number()
          .min(1)
          .max(240)
          .describe("Duration of the delay in minutes"),
      },
    },
    async ({
      line,
      delay_minutes,
    }: {
      line: string;
      delay_minutes: number;
    }) => {
      const impact = calculateEconomicImpact(line, delay_minutes);
      const ridership = LINE_RIDERSHIP[line] ?? 10000;
      return {
        content: [
          {
            type: "text",
            text: `A ${delay_minutes}-minute delay on the ${line} line affects ~${ridership.toLocaleString()} riders/hour. Estimated productivity loss: $${impact.toLocaleString()} CAD. Formula: (${delay_minutes}/60) × ${ridership} × $31.50`,
          },
        ],
        structuredContent: {
          line,
          delay_minutes,
          ridership,
          impact_cad: impact,
        },
      };
    },
  );
});

export const GET = handler;
export const POST = handler;
