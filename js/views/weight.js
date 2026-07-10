// Weight view: quick daily entry (one record per day, same-day entry overwrites),
// stat tile with trend (7-day avg vs previous 7-day avg), SVG line chart with
// 30/90/all ranges, recent entries list with delete.

import { load, save } from "../storage.js";
import { escapeHtml, fmtKg, fmtDateShort, fmtDateFull } from "../format.js";
import { lineChartSvg } from "../chart.js";

const TREND_THRESHOLD = 0.2; // kg/week considered "stable"
const DAY_MS = 86_400_000;

let range = "30"; // "30" | "90" | "all"
let selectedDate = null; // chart point tapped by the user

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
        ? lineChartSvg(points.map((p) => ({ x: p.date, y: p.kg })), {
            formatY: fmtKg, formatXShort: fmtDateShort, selectedX: selectedDate, ariaLabel: "Graf vývoje váhy",
          })
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
      selectedDate = selectedDate === dot.dataset.x ? null : dot.dataset.x;
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
