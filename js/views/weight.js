// Weight view: quick daily entry (one record per day, same-day entry overwrites),
// stat tile with trend (7-day avg vs previous 7-day avg), SVG line chart with
// 30/90/all ranges, recent entries list with delete.

import { load, save } from "../storage.js";
import { escapeHtml, fmtKg, fmtDateShort, fmtDateFull, todayStr } from "../format.js";
import { lineChartSvg } from "../chart.js";

const TREND_THRESHOLD = 0.2; // kg/week considered "stable"
const DAY_MS = 86_400_000;

let range = "30"; // "30" | "90" | "all"
let selectedDate = null; // chart point tapped by the user
let editingGoal = false;

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

// ---------- Goal weight ----------

function goalCard(weights, settings) {
  const target = settings.targetWeightKg ?? null;

  if (editingGoal) {
    return `
      <div class="card">
        <h3>🎯 Cílová váha</h3>
        <label class="field">Cíl (kg) — prázdné zruší cíl
          <input type="number" id="goal-kg" inputmode="decimal" step="0.1" min="30" max="300" value="${target ?? ""}" placeholder="např. 100">
        </label>
        <div class="edit-actions">
          <button class="btn btn-primary" data-action="save-goal">Uložit</button>
          <button class="btn btn-ghost" data-action="cancel-goal">Zrušit</button>
        </div>
      </div>`;
  }

  if (target == null) {
    return `
      <div class="card">
        <div class="card-head">
          <h3>🎯 Cíl</h3>
          <button class="btn-chip" data-action="edit-goal">Nastavit</button>
        </div>
        <p class="hint">Nastav si cílovou váhu a appka spočítá, kdy ji při současném tempu dosáhneš.</p>
      </div>`;
  }

  const last = weights[weights.length - 1];
  const trend = computeTrend(weights);
  const diff = last ? last.kg - target : null; // positive = needs to lose, negative = needs to gain
  let body;
  if (diff == null) {
    body = `<p class="goal-progress">Zapiš váhu a appka spočítá zbytek k cíli.</p>`;
  } else if (Math.abs(diff) < 0.1) {
    body = `<p class="goal-progress goal-reached">🎉 Cíl dosažen!</p>`;
  } else {
    const remaining = `${diff > 0 ? "Zbývá zhubnout" : "Zbývá přibrat"} <strong>${fmtKg(Math.abs(diff).toFixed(1))} kg</strong>`;
    const onTrack = trend && Math.sign(trend.perWeek) === Math.sign(-diff) && Math.abs(trend.perWeek) > 0.05;
    const eta = onTrack
      ? `<span class="goal-eta">Při současném tempu (${fmtKg(trend.perWeek.toFixed(1))} kg/týden) kolem ${new Date(Date.now() + (Math.abs(diff) / Math.abs(trend.perWeek)) * 7 * DAY_MS).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" })}</span>`
      : `<span class="goal-eta">Trend zatím k cíli nesměřuje</span>`;
    body = `<p class="goal-progress">${remaining}</p>${eta}`;
  }

  return `
    <div class="card">
      <div class="card-head">
        <h3>🎯 Cíl</h3>
        <button class="btn-chip" data-action="edit-goal">Upravit</button>
      </div>
      <p class="goal-value">${fmtKg(target)} kg</p>
      ${body}
    </div>`;
}

// ---------- Chart ----------

function filterByRange(weights) {
  if (range === "all") return weights;
  const cutoff = Date.now() - Number(range) * DAY_MS;
  return weights.filter((w) => Date.parse(w.date) >= cutoff);
}

// Trailing N-day average, aligned to each entry's own date — smooths out
// day-to-day water-weight noise so the real trend is easier to read.
function movingAverage(allWeights, windowDays = 7) {
  return allWeights.map((w) => {
    const t = Date.parse(w.date);
    const cutoff = t - (windowDays - 1) * DAY_MS;
    const inWindow = allWeights.filter((x) => {
      const xt = Date.parse(x.date);
      return xt <= t && xt >= cutoff;
    });
    const avg = inWindow.reduce((s, x) => s + x.kg, 0) / inWindow.length;
    return { date: w.date, kg: Math.round(avg * 10) / 10 };
  });
}

function chartCard(weights) {
  const points = filterByRange(weights);
  const maPoints = weights.length >= 4 ? filterByRange(movingAverage(weights)) : [];
  const chip = (value, label) =>
    `<button class="btn-chip${range === value ? " active" : ""}" data-action="range" data-range="${value}">${label}</button>`;
  const selected = points.find((p) => p.date === selectedDate);
  const showMa = maPoints.length >= 2;
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
        ? `${lineChartSvg(points.map((p) => ({ x: p.date, y: p.kg })), {
              formatY: fmtKg, formatXShort: fmtDateShort, selectedX: selectedDate, ariaLabel: "Graf vývoje váhy",
              secondary: showMa ? maPoints.map((p) => ({ x: p.date, y: p.kg })) : null,
            })}
            ${showMa ? `<p class="chart-legend"><span class="legend-swatch raw"></span> váha <span class="legend-swatch ma"></span> 7denní průměr</p>` : ""}`
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
  const settings = load("settings", {});
  const last = weights[weights.length - 1];

  el.innerHTML = `
    <h2>Tělesná váha</h2>
    ${statTile(weights)}
    ${goalCard(weights, settings)}
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
    } else if (action === "edit-goal") {
      editingGoal = true;
      renderWeight(el);
    } else if (action === "cancel-goal") {
      editingGoal = false;
      renderWeight(el);
    } else if (action === "save-goal") {
      const raw = document.getElementById("goal-kg").value.trim();
      const settings = load("settings", {});
      if (raw === "") {
        delete settings.targetWeightKg;
      } else {
        const kg = parseFloat(raw);
        if (!Number.isFinite(kg) || kg < 30 || kg > 300) {
          alert("Zadej platnou cílovou váhu (30–300 kg).");
          return;
        }
        settings.targetWeightKg = Math.round(kg * 10) / 10;
      }
      save("settings", settings);
      editingGoal = false;
      renderWeight(el);
    }
  };
}
