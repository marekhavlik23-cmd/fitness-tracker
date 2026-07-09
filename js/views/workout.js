// Workout view: plan overview + recommended start, plan editing, session history.
// The live workout itself is rendered by views/session.js.

import { load, save, uid } from "../storage.js";
import { escapeHtml, targetText, weightText, setSummary, fmtSessionDate } from "../format.js";
import { hasActiveSession, startSession, renderSession } from "./session.js";

let editingPlanId = null;

// Alternate plans: whatever wasn't trained last time comes up first.
function pickRecommended(plans, lastPlanId) {
  if (!plans.length) return null;
  const lastIndex = plans.findIndex((p) => p.id === lastPlanId);
  return plans[(lastIndex + 1) % plans.length];
}

function exerciseRow(ex) {
  return `
    <div class="exercise-row">
      <div>
        <span class="exercise-name">${escapeHtml(ex.name)}</span>
        ${ex.note ? `<span class="exercise-note">${escapeHtml(ex.note)}</span>` : ""}
      </div>
      <div class="exercise-target">
        ${targetText(ex)}
        <span class="exercise-weight">${weightText(ex)}</span>
      </div>
    </div>`;
}

function planCard(plan) {
  return `
    <div class="card">
      <div class="card-head">
        <h3>${escapeHtml(plan.name)}</h3>
        <div class="card-actions">
          <button class="btn-chip" data-action="start" data-plan="${plan.id}">▶ Start</button>
          <button class="btn-chip" data-action="edit" data-plan="${plan.id}">✏️ Upravit</button>
        </div>
      </div>
      ${plan.exercises.map(exerciseRow).join("")}
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
    note: document.getElementById("ex-note"),
    howto: document.getElementById("ex-howto"),
  };

  fields.name.value = exercise?.name ?? "";
  fields.mode.value = exercise?.mode ?? "reps";
  fields.sets.value = exercise?.sets ?? 3;
  fields.min.value = exercise?.repsMin ?? 8;
  fields.max.value = exercise?.repsMax ?? 10;
  fields.weight.value = exercise?.weightKg ?? "";
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
    <h2>Tréninkové plány</h2>
    ${plans.map((p) => (p.id === editingPlanId ? planEditCard(p) : planCard(p))).join("")}
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

    if (action === "start" && plan) {
      startSession(plan);
      renderWorkout(el);
    } else if (action === "edit" && plan) {
      editingPlanId = plan.id;
      renderWorkout(el);
    } else if (action === "done-edit") {
      editingPlanId = null;
      renderWorkout(el);
    } else if (action === "add-ex" && plan) {
      openExerciseDialog(el, plan, null);
    } else if (action === "edit-ex" && plan) {
      openExerciseDialog(el, plan, plan.exercises.find((x) => x.id === btn.dataset.ex));
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
