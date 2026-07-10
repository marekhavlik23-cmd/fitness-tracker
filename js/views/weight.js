// Weight view: quick daily entry (one record per day, same-day entry overwrites),
// stat tile with trend (7-day avg vs previous 7-day avg), SVG line chart with
// 30/90/all ranges, recent entries list with delete.

import { load, save } from "../storage.js";
import { escapeHtml, fmtKg } from "../format.js";

const TREND_THRESHOLD = 0.2; // kg/week considered "stable"
const DAY_MS = 86_400_000;

let range = "30"; // "30" | "90" | "all"
let selectedDate = null; // chart point tapped by the user

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDateShort(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

function fmtDateFull(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
}

function upsertWeight(date, kg) {
  const weights = load("weights", []);
  const existing = weights.find((w) => w.date === date);
  if (existing) existing.kg = kg;
  else weights.push({ date, kg });
  weights.sort((a, b) => a.date.localeCompare(b.date));
  save("weights", weights);
}

// 7-day average vs the previous 7 days, anchored to the newest entry.
function computeTrend(weights) {
  if (weights.length < 4) return null;
  const lastTs = Date.parse(weights[weights.length - 1].date);
  const inWindow = (w, from, to) => {
    const ts = Date.parse(w.date);
    return ts > from && ts <= to;
  };
  const recent = weights.filter((w) => inWindow(w, lastTs - 7 * DAY_MS, lastTs));
  const previous = weights.filter((w) => inWindow(w, lastTs - 14 * DAY_MS, lastTs - 7 * DAY_MS));
  if (recent.length < 2 || previous.length < 2) return null;
  const avg = (arr) => arr.reduce((s, w) => s + w.kg, 0) / arr.length;
  const perWeek = avg(recent) - avg(previous);
  if (perWeek < -TREND_THRESHOLD) return { perWeek, cls: "down", text: "hubneš" };
  if (perWeek > TREND_THRESHOLD) return { perWeek, cls: "up", text: "přibíráš" };
  return { perWeek, cls: "flat", text: "stagnace" };
}

function statTile(weights) {
  if (!weights.length) return "";
  const last = weights[weights.length - 1];
  const trend = computeTrend(weights);
  const arrows = { down: "↘", up: "↗", flat: "→" };
  const trendHtml = trend
    ? `<span class="trend trend-${trend.cls}">${arrows[trend.cls]} ${trend.text} · ${trend.perWeek > 0 ? "+" : ""}${fmtKg(trend.perWeek.toFixed(1))} kg/týden</span>`
    : `<span class="trend trend-flat">trend ukáže víc zápisů</span>`;
  return `
    <div class="card stat-tile">
      <span class="stat-label">Aktuální váha · ${fmtDateFull(last.date)}</span>
      <span class="stat-value">${fmtKg(last.kg)} <small>kg</small></span>
      ${trendHtml}
    </div>`;
}

// ---------- Chart ----------

function filterByRange(weights) {
  if (range === "all") return weights;
  const cutoff = Date.now() - Number(range) * DAY_MS;
  return weights.filter((w) => Date.parse(w.date) >= cutoff);
}

function niceTicks(min, max) {
  for (const step of [0.5, 1, 2, 5, 10, 20]) {
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const count = Math.round((hi - lo) / step);
    if (count <= 5) {
      const ticks = [];
      for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);
      return ticks;
    }
  }
  return [min, max];
}

function chartSvg(points) {
  const W = 343, H = 190;
  const pad = { l: 38, r: 12, t: 10, b: 24 };
  const kgs = points.map((p) => p.kg);
  let min = Math.min(...kgs), max = Math.max(...kgs);
  if (max - min < 1) { min -= 0.5; max += 0.5; }
  const ticks = niceTicks(min, max);
  min = ticks[0];
  max = ticks[ticks.length - 1];

  const t0 = Date.parse(points[0].date);
  const t1 = Date.parse(points[points.length - 1].date);
  const spanMs = Math.max(t1 - t0, DAY_MS);
  const x = (p) => pad.l + ((Date.parse(p.date) - t0) / spanMs) * (W - pad.l - pad.r);
  const y = (kg) => pad.t + (1 - (kg - min) / (max - min)) * (H - pad.t - pad.b);

  const grid = ticks.map((v) => `
    <line x1="${pad.l}" y1="${y(v)}" x2="${W - pad.r}" y2="${y(v)}" class="chart-grid"/>
    <text x="${pad.l - 6}" y="${y(v) + 3}" class="chart-tick" text-anchor="end">${fmtKg(v)}</text>`).join("");

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");

  const dots = points.map((p, i) => {
    const isLast = i === points.length - 1;
    const isSelected = p.date === selectedDate;
    return `
      <circle cx="${x(p).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="${isLast || isSelected ? 4.5 : 2.5}"
        class="chart-dot${isLast ? " last" : ""}${isSelected ? " selected" : ""}" data-date="${p.date}"/>`;
  }).join("");

  const xLabels = `
    <text x="${pad.l}" y="${H - 8}" class="chart-tick" text-anchor="start">${fmtDateShort(points[0].date)}</text>
    <text x="${W - pad.r}" y="${H - 8}" class="chart-tick" text-anchor="end">${fmtDateShort(points[points.length - 1].date)}</text>`;

  return `
    <svg viewBox="0 0 ${W} ${H}" class="weight-chart" role="img" aria-label="Graf vývoje váhy">
      ${grid}
      <path d="${path}" class="chart-line"/>
      ${dots}
      ${points.length > 1 ? xLabels : ""}
    </svg>`;
}

function chartCard(weights) {
  const points = filterByRange(weights);
  const chip = (value, label) =>
    `<button class="btn-chip${range === value ? " active" : ""}" data-action="range" data-range="${value}">${label}</button>`;
  const selected = points.find((p) => p.date === selectedDate);
  return `
    <div class="card">
      <div class="card-head">
        <h3>Vývoj</h3>
        <div class="card-actions">
          ${chip("30", "30 dní")}${chip("90", "90 dní")}${chip("all", "Vše")}
        </div>
      </div>
      ${selected ? `<p class="chart-selected">${fmtDateFull(selected.date)} · <strong>${fmtKg(selected.kg)} kg</strong></p>` : ""}
      ${points.length >= 2
        ? chartSvg(points)
        : `<p class="hint">Zapiš váhu aspoň dva dny a tady se ukáže graf.</p>`}
    </div>`;
}

function entriesList(weights) {
  if (!weights.length) return "";
  const rows = weights.slice(-8).reverse().map((w) => `
    <div class="weight-row">
      <span>${fmtDateFull(w.date)}</span>
      <span class="weight-row-kg">${fmtKg(w.kg)} kg</span>
      <button class="btn-icon-sm" data-action="del-weight" data-date="${w.date}" aria-label="Smazat záznam">🗑️</button>
    </div>`).join("");
  return `
    <div class="card">
      <h3>Poslední záznamy</h3>
      ${rows}
    </div>`;
}

// ---------- Main render ----------

export function renderWeight(el) {
  const weights = load("weights", []);
  const last = weights[weights.length - 1];

  el.innerHTML = `
    <h2>Tělesná váha</h2>
    ${statTile(weights)}
    <div class="card">
      <h3>Rychlý zápis</h3>
      <div class="weight-form">
        <label class="field">Datum
          <input type="date" id="weight-date" value="${todayStr()}" max="${todayStr()}">
        </label>
        <label class="field">Váha (kg)
          <input type="number" id="weight-kg" inputmode="decimal" step="0.1" min="30" max="300"
            value="${last ? last.kg : ""}" placeholder="např. 111,0">
        </label>
      </div>
      <button class="btn btn-primary" data-action="save-weight">Uložit váhu</button>
    </div>
    ${chartCard(weights)}
    ${entriesList(weights)}`;

  el.onclick = (e) => {
    const dot = e.target.closest(".chart-dot");
    if (dot) {
      selectedDate = selectedDate === dot.dataset.date ? null : dot.dataset.date;
      renderWeight(el);
      return;
    }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "save-weight") {
      const date = document.getElementById("weight-date").value;
      const kg = parseFloat(document.getElementById("weight-kg").value);
      if (!date || !Number.isFinite(kg) || kg < 30 || kg > 300) {
        alert("Zadej platnou váhu (30–300 kg).");
        return;
      }
      upsertWeight(date, Math.round(kg * 10) / 10);
      selectedDate = null;
      renderWeight(el);
    } else if (action === "range") {
      range = btn.dataset.range;
      selectedDate = null;
      renderWeight(el);
    } else if (action === "del-weight") {
      if (confirm(`Smazat záznam z ${fmtDateFull(btn.dataset.date)}?`)) {
        save("weights", load("weights", []).filter((w) => w.date !== btn.dataset.date));
        selectedDate = null;
        renderWeight(el);
      }
    }
  };
}
