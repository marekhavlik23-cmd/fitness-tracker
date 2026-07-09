// Workout view — phase 1: read-only listing of the stored plans.
// Phase 2 adds plan editing, the "start workout" mode and session history.

import { load } from "../storage.js";

function targetText(ex) {
  if (ex.mode === "amrap") return `${ex.sets}× max`;
  if (ex.mode === "time") return `${ex.sets}× ${ex.repsMin}–${ex.repsMax} s`;
  return `${ex.sets}× ${ex.repsMin}–${ex.repsMax}`;
}

function weightText(ex) {
  return ex.weightKg == null ? "vlastní váha" : `${ex.weightKg} kg`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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
      <h3>${escapeHtml(plan.name)}</h3>
      ${plan.exercises.map(exerciseRow).join("")}
    </div>`;
}

export function renderWorkout(el) {
  const plans = load("plans", []);
  el.innerHTML = `
    <h2>Tréninkové plány</h2>
    ${plans.map(planCard).join("")}
    <p class="hint">
      Úprava plánů, režim „Start tréninku“ s odškrtáváním sérií
      a historie výkonů přijdou ve fázi 2.
    </p>`;
}
