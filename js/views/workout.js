// Workout view: plan overview + recommended start, plan editing, session history,
// stats/records, and per-exercise strength charts.
// The live workout itself is rendered by views/session.js.

import { load, save, uid } from "../storage.js";
import { escapeHtml, targetText, weightText, setSummary, fmtSessionDate, fmtKg, fmtDateShort, fmtDateFull } from "../format.js";
import { lineChartSvg } from "../chart.js";
import { hasActiveSession, startSession, renderSession } from "./session.js";

let editingPlanId = null;

// Alternate plans: whatever wasn't trained last time comes up first.
// Empty plans (just created, no exercises yet) are never recommended.
function pickRecommended(plans, lastPlanId) {
  const candidates = plans.filter((p) => p.exercises.length > 0);
  if (!candidates.length) return null;
  const lastIndex = candidates.findIndex((p) => p.id === lastPlanId);
  return candidates[(lastIndex + 1) % candidates.length];
}

function exerciseRow(ex, planId) {
  return `
    <div class="exercise-row">
      <div class="exercise-row-main">
        <div>
          <span class="exercise-name">${escapeHtml(ex.name)}</span>
          ${ex.note ? `<span class="exercise-note">${escapeHtml(ex.note)}</span>` : ""}
        </div>
        <div class="exercise-target">
          ${targetText(ex)}
          <span class="exercise-weight">${weightText(ex)}</span>
        </div>
      </div>
      <button class="btn-icon-sm" data-action="stats-ex" data-plan="${planId}" data-ex="${ex.id}" aria-label="Graf progrese cviku">📈</button>
    </div>`;
}

function planCard(plan) {
  const empty = plan.exercises.length === 0;
  return `
    <div class="card">
      <div class="card-head">
        <h3>${escapeHtml(plan.name)}</h3>
        <div class="card-actions">
          <button class="btn-chip" data-action="start" data-plan="${plan.id}" ${empty ? "disabled" : ""}>▶ Start</button>
          <button class="btn-chip" data-action="edit" data-plan="${plan.id}">✏️ Upravit</button>
        </div>
      </div>
      ${empty
        ? `<p class="hint">Zatím bez cviků — přidej je přes „Upravit“.</p>`
        : plan.exercises.map((ex) => exerciseRow(ex, plan.id)).join("")}
    </div>`;
}

function planEditCard(plan) {
  const rows = plan.exercises.map((ex, i) => `
    <div class="edit-row">
      <div class="edit-info">
        <span class="edit-name">${escapeHtml(ex.name)}</span>
        <span class="edit-target">${targetText(ex)} · ${weightText(ex)}</span>
      </div>
      <button class="btn-icon-sm" data-action="move-ex" data-plan="${plan.id}" data-ex="${ex.id}" data-dir="-1" ${i === 0 ? "disabled" : ""} aria-label="Posunout nahoru">↑</button>
      <button class="btn-icon-sm" data-action="move-ex" data-plan="${plan.id}" data-ex="${ex.id}" data-dir="1" ${i === plan.exercises.length - 1 ? "disabled" : ""} aria-label="Posunout dolů">↓</button>
      <button class="btn-icon-sm" data-action="edit-ex" data-plan="${plan.id}" data-ex="${ex.id}" aria-label="Upravit cvik">✏️</button>
      <button class="btn-icon-sm" data-action="del-ex" data-plan="${plan.id}" data-ex="${ex.id}" aria-label="Smazat cvik">🗑️</button>
    </div>`).join("");

  return `
    <div class="card card-editing">
      <label class="field">Název plánu
        <input data-field="plan-name" data-plan="${plan.id}" value="${escapeHtml(plan.name)}" maxlength="30">
      </label>
      ${rows}
      <div class="edit-actions">
        <button class="btn btn-secondary" data-action="add-ex" data-plan="${plan.id}">+ Přidat cvik</button>
        <button class="btn btn-primary" data-action="done-edit">Hotovo</button>
      </div>
      <button class="btn btn-danger-ghost" data-action="del-plan" data-plan="${plan.id}">🗑️ Smazat celý plán</button>
    </div>`;
}

function historyItem(session) {
  const doneExercises = session.exercises.filter((e) => e.sets.length > 0).length;
  const minutes = Math.max(1, Math.round((session.finishedAt - session.startedAt) / 60000));
  const rows = session.exercises.map((e) => `
    <div class="history-ex">
      <span>${escapeHtml(e.name)}</span>
      <span>${e.sets.length ? e.sets.map((s) => setSummary(e.mode, s)).join(" · ") : "—"}</span>
    </div>`).join("");

  return `
    <details class="card history-item">
      <summary>
        <span>${fmtSessionDate(session.startedAt)} · ${escapeHtml(session.planName)}</span>
        <span class="history-meta">${doneExercises}/${session.exercises.length} cviků · ${minutes} min</span>
      </summary>
      <div class="history-body">
        ${rows}
        <button class="btn btn-ghost btn-small" data-action="del-session" data-id="${session.id}">🗑️ Smazat záznam</button>
      </div>
    </details>`;
}

// ---------- Stats & records ----------

function computeStats(sessions, plans) {
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const weekAgo = Date.now() - 7 * 86_400_000;

  let totalVolume = 0;
  for (const s of sessions) {
    for (const e of s.exercises) {
      for (const set of e.sets) {
        if (set.weightKg != null) totalVolume += set.weightKg * set.reps;
      }
    }
  }

  const exerciseMeta = new Map();
  for (const p of plans) for (const ex of p.exercises) exerciseMeta.set(ex.id, ex);

  const bestByExercise = new Map(); // exerciseId -> { value, date, name, mode }
  for (const s of sessions) {
    for (const e of s.exercises) {
      const meta = exerciseMeta.get(e.exerciseId);
      if (!meta || (meta.mode !== "reps" && meta.mode !== "amrap")) continue;
      const values = e.sets
        .map((set) => (meta.mode === "reps" ? set.weightKg : set.reps))
        .filter((v) => v != null);
      if (!values.length) continue;
      const best = Math.max(...values);
      const current = bestByExercise.get(e.exerciseId);
      if (!current || best > current.value) {
        bestByExercise.set(e.exerciseId, { value: best, date: s.date, name: e.name, mode: meta.mode });
      }
    }
  }
  const records = [...bestByExercise.values()];

  return {
    totalWorkouts: sessions.length,
    thisMonth: sessions.filter((s) => s.date.startsWith(monthPrefix)).length,
    last7d: sessions.filter((s) => s.startedAt >= weekAgo).length,
    totalVolume,
    weightPRs: records.filter((r) => r.mode === "reps").sort((a, b) => b.value - a.value),
    repPRs: records.filter((r) => r.mode === "amrap").sort((a, b) => b.value - a.value),
  };
}

function statsCard(stats) {
  if (stats.totalWorkouts === 0) return "";
  const prRow = (r, unit) => `
    <div class="pr-row"><span>${escapeHtml(r.name)}</span><span>${unit === "kg" ? fmtKg(r.value) : r.value}${unit === "kg" ? " kg" : "×"}</span></div>`;

  return `
    <details class="card stats-card">
      <summary>📊 Statistiky a rekordy</summary>
      <div class="stats-grid">
        <div class="stat-box"><span class="stat-box-value">${stats.totalWorkouts}</span><span class="stat-box-label">tréninků celkem</span></div>
        <div class="stat-box"><span class="stat-box-value">${stats.thisMonth}</span><span class="stat-box-label">tento měsíc</span></div>
        <div class="stat-box"><span class="stat-box-value">${stats.last7d}</span><span class="stat-box-label">posl. 7 dní</span></div>
        <div class="stat-box"><span class="stat-box-value">${Math.round(stats.totalVolume).toLocaleString("cs-CZ")}</span><span class="stat-box-label">kg zvednuto</span></div>
      </div>
      ${stats.weightPRs.length ? `<h4 class="stats-subhead">Váhové rekordy</h4>${stats.weightPRs.map((r) => prRow(r, "kg")).join("")}` : ""}
      ${stats.repPRs.length ? `<h4 class="stats-subhead">Max opakování</h4>${stats.repPRs.map((r) => prRow(r, "x")).join("")}` : ""}
    </details>`;
}

// ---------- Per-exercise strength chart dialog ----------

function exerciseHistoryPoints(exerciseId, mode) {
  const sessions = load("sessions", []).slice().sort((a, b) => a.startedAt - b.startedAt);
  const points = [];
  for (const s of sessions) {
    const entry = s.exercises.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (!entry) continue;
    const values = entry.sets
      .map((set) => (mode === "reps" ? set.weightKg : set.reps))
      .filter((v) => v != null);
    if (!values.length) continue;
    points.push({ x: s.date, y: Math.max(...values) });
  }
  return points;
}

function openExerciseStats(exercise) {
  const dialog = document.getElementById("exercise-stats-dialog");
  document.getElementById("exercise-stats-title").textContent = exercise.name;
  const body = document.getElementById("exercise-stats-body");
  const points = exerciseHistoryPoints(exercise.id, exercise.mode);
  const unit = exercise.mode === "reps" ? "kg" : exercise.mode === "time" ? "s" : "op.";
  const fmtVal = (v) => (exercise.mode === "reps" ? fmtKg(v) : String(Math.round(v)));

  if (points.length < 2) {
    body.innerHTML = `<p class="hint">Zatím málo odcvičených tréninků s tímto cvikem — graf se ukáže po druhém záznamu.</p>`;
  } else {
    const best = points.reduce((a, b) => (b.y > a.y ? b : a));
    body.innerHTML = `
      <p class="stat-pr">🏆 Rekord: <strong>${fmtVal(best.y)} ${unit}</strong> · ${fmtDateFull(best.x)}</p>
      ${lineChartSvg(points, { formatY: fmtVal, formatXShort: fmtDateShort, ariaLabel: `Graf progrese: ${exercise.name}` })}`;
  }
  document.getElementById("exercise-stats-close").onclick = () => dialog.close();
  dialog.showModal();
}

// ---------- Exercise add/edit dialog ----------

function openExerciseDialog(el, plan, exercise) {
  const dialog = document.getElementById("exercise-dialog");
  const form = document.getElementById("exercise-form");
  document.getElementById("exercise-dialog-title").textContent = exercise ? "Upravit cvik" : "Nový cvik";

  const fields = {
    name: document.getElementById("ex-name"),
    mode: document.getElementById("ex-mode"),
    sets: document.getElementById("ex-sets"),
    min: document.getElementById("ex-min"),
    max: document.getElementById("ex-max"),
    weight: document.getElementById("ex-weight"),
    rest: document.getElementById("ex-rest"),
    note: document.getElementById("ex-note"),
    howto: document.getElementById("ex-howto"),
  };

  fields.name.value = exercise?.name ?? "";
  fields.mode.value = exercise?.mode ?? "reps";
  fields.sets.value = exercise?.sets ?? 3;
  fields.min.value = exercise?.repsMin ?? 8;
  fields.max.value = exercise?.repsMax ?? 10;
  fields.weight.value = exercise?.weightKg ?? "";
  fields.rest.value = exercise?.restSec ?? "";
  fields.note.value = exercise?.note ?? "";
  fields.howto.value = exercise?.howto ?? "";

  const syncRangeVisibility = () => {
    const amrap = fields.mode.value === "amrap";
    document.querySelectorAll(".ex-range").forEach((label) => (label.hidden = amrap));
    fields.min.required = fields.max.required = !amrap;
  };
  fields.mode.onchange = syncRangeVisibility;
  syncRangeVisibility();

  form.onsubmit = (e) => {
    e.preventDefault();
    const amrap = fields.mode.value === "amrap";
    let repsMin = amrap ? null : Number(fields.min.value);
    let repsMax = amrap ? null : Number(fields.max.value);
    if (!amrap && repsMin > repsMax) [repsMin, repsMax] = [repsMax, repsMin];
    const weightRaw = fields.weight.value.trim();

    const values = {
      name: fields.name.value.trim(),
      mode: fields.mode.value,
      sets: Number(fields.sets.value),
      repsMin,
      repsMax,
      weightKg: weightRaw === "" ? null : Number(weightRaw),
      restSec: fields.rest.value.trim() === "" ? null : Number(fields.rest.value),
      note: fields.note.value.trim(),
      howto: fields.howto.value.trim(),
    };

    if (exercise) {
      Object.assign(exercise, values);
    } else {
      plan.exercises.push({ id: uid(), ...values });
    }
    save("plans", load("plans", []).map((p) => (p.id === plan.id ? plan : p)));
    dialog.close();
    renderWorkout(el);
  };

  document.getElementById("ex-cancel").onclick = () => dialog.close();
  dialog.showModal();
}

// ---------- Main render ----------

export function renderWorkout(el) {
  if (hasActiveSession()) {
    renderSession(el, () => renderWorkout(el));
    return;
  }

  const plans = load("plans", []);
  const settings = load("settings", {});
  const recommended = editingPlanId ? null : pickRecommended(plans, settings.lastPlanId);
  const sessions = load("sessions", []).slice().sort((a, b) => b.startedAt - a.startedAt);

  el.innerHTML = `
    ${recommended ? `<button class="btn btn-primary btn-big" data-action="start" data-plan="${recommended.id}">▶ Začít: ${escapeHtml(recommended.name)}</button>` : ""}
    ${statsCard(computeStats(sessions, plans))}
    <h2>Tréninkové plány</h2>
    ${plans.length ? "" : `<p class="hint">Zatím žádný tréninkový plán. Přidej první tlačítkem níže.</p>`}
    ${plans.map((p) => (p.id === editingPlanId ? planEditCard(p) : planCard(p))).join("")}
    ${!editingPlanId ? `<button class="btn btn-secondary" data-action="add-plan">+ Nový tréninkový plán</button>` : ""}
    <h2>Historie</h2>
    ${sessions.length
      ? sessions.slice(0, 20).map(historyItem).join("")
      : `<p class="hint">Zatím žádný odcvičený trénink.<br>Klepni nahoře na „Začít“ a jde se na to. 💪</p>`}`;

  el.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    const plans = load("plans", []);
    const plan = plans.find((p) => p.id === btn.dataset.plan);

    if (action === "start" && plan && plan.exercises.length > 0) {
      startSession(plan);
      renderWorkout(el);
    } else if (action === "edit" && plan) {
      editingPlanId = plan.id;
      renderWorkout(el);
    } else if (action === "done-edit") {
      editingPlanId = null;
      renderWorkout(el);
    } else if (action === "add-plan") {
      const newPlan = { id: uid(), name: "Nový plán", exercises: [] };
      plans.push(newPlan);
      save("plans", plans);
      editingPlanId = newPlan.id;
      renderWorkout(el);
    } else if (action === "del-plan" && plan) {
      if (confirm(`Opravdu smazat celý plán „${plan.name}“ i se všemi cviky? Odcvičená historie zůstane zachována.`)) {
        save("plans", plans.filter((p) => p.id !== plan.id));
        editingPlanId = null;
        renderWorkout(el);
      }
    } else if (action === "add-ex" && plan) {
      openExerciseDialog(el, plan, null);
    } else if (action === "edit-ex" && plan) {
      openExerciseDialog(el, plan, plan.exercises.find((x) => x.id === btn.dataset.ex));
    } else if (action === "stats-ex" && plan) {
      const ex = plan.exercises.find((x) => x.id === btn.dataset.ex);
      if (ex) openExerciseStats(ex);
    } else if (action === "del-ex" && plan) {
      const ex = plan.exercises.find((x) => x.id === btn.dataset.ex);
      if (ex && confirm(`Smazat cvik „${ex.name}“ z plánu?`)) {
        plan.exercises = plan.exercises.filter((x) => x.id !== btn.dataset.ex);
        save("plans", plans);
        renderWorkout(el);
      }
    } else if (action === "move-ex" && plan) {
      const i = plan.exercises.findIndex((x) => x.id === btn.dataset.ex);
      const j = i + Number(btn.dataset.dir);
      if (i >= 0 && j >= 0 && j < plan.exercises.length) {
        [plan.exercises[i], plan.exercises[j]] = [plan.exercises[j], plan.exercises[i]];
        save("plans", plans);
        renderWorkout(el);
      }
    } else if (action === "del-session") {
      if (confirm("Smazat tento záznam tréninku z historie?")) {
        save("sessions", load("sessions", []).filter((s) => s.id !== btn.dataset.id));
        renderWorkout(el);
      }
    }
  };

  el.onchange = (e) => {
    const input = e.target.closest('input[data-field="plan-name"]');
    if (!input) return;
    const plans = load("plans", []);
    const plan = plans.find((p) => p.id === input.dataset.plan);
    if (plan && input.value.trim()) {
      plan.name = input.value.trim();
      save("plans", plans);
    }
  };
}
