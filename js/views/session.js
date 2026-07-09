// Active workout mode: one exercise at a time, big checkable sets.
// The in-progress session lives in ft.activeSession so it survives reloads
// and accidental tab closes mid-workout.

import { load, save, uid } from "../storage.js";
import { escapeHtml, targetText, localDate } from "../format.js";

export function hasActiveSession() {
  return load("activeSession") != null;
}

export function startSession(plan) {
  const sessions = load("sessions", []);
  const active = {
    planId: plan.id,
    planName: plan.name,
    startedAt: Date.now(),
    currentIndex: 0,
    exercises: plan.exercises.map((ex) => ({
      exerciseId: ex.id,
      name: ex.name,
      note: ex.note || "",
      howto: ex.howto || "",
      mode: ex.mode,
      targetSets: ex.sets,
      targetRepsMin: ex.repsMin,
      targetRepsMax: ex.repsMax,
      sets: buildSets(ex, sessions),
    })),
  };
  save("activeSession", active);
}

// Prefill from the last logged performance of this exercise, else from the plan.
function lastLoggedSets(exerciseId, sessions) {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const found = sessions[i].exercises?.find((e) => e.exerciseId === exerciseId && e.sets.length > 0);
    if (found) return found.sets;
  }
  return null;
}

function buildSets(ex, sessions) {
  const prev = lastLoggedSets(ex.id, sessions);
  const sets = [];
  for (let i = 0; i < ex.sets; i++) {
    const p = prev ? prev[Math.min(i, prev.length - 1)] : null;
    sets.push({
      reps: p ? p.reps : ex.mode === "amrap" ? 5 : ex.repsMin,
      weightKg: ex.weightKg == null ? null : p && p.weightKg != null ? p.weightKg : ex.weightKg,
      done: false,
    });
  }
  return sets;
}

function setCard(ex, set, i) {
  const unit = ex.mode === "time" ? "s" : "op.";
  const step = ex.mode === "time" ? 5 : 1;
  const weightStepper = set.weightKg == null ? "" : `
      <div class="stepper">
        <button data-action="adj" data-set="${i}" data-field="weightKg" data-delta="-2.5" aria-label="Ubrat váhu">−</button>
        <div class="stepper-value">
          <input type="number" inputmode="decimal" step="0.5" min="0" value="${set.weightKg}" data-set="${i}" data-field="weightKg">
          <span class="unit">kg</span>
        </div>
        <button data-action="adj" data-set="${i}" data-field="weightKg" data-delta="2.5" aria-label="Přidat váhu">+</button>
      </div>`;
  return `
  <div class="set-card${set.done ? " done" : ""}">
    <div class="set-head">
      <span class="set-label">Série ${i + 1}</span>
      <button class="check-btn" data-action="toggle" data-set="${i}" aria-label="Označit sérii jako hotovou">✓</button>
    </div>
    <div class="set-controls">
      ${weightStepper}
      <div class="stepper">
        <button data-action="adj" data-set="${i}" data-field="reps" data-delta="${-step}" aria-label="Ubrat">−</button>
        <div class="stepper-value">
          <input type="number" inputmode="numeric" step="1" min="0" value="${set.reps}" data-set="${i}" data-field="reps">
          <span class="unit">${unit}</span>
        </div>
        <button data-action="adj" data-set="${i}" data-field="reps" data-delta="${step}" aria-label="Přidat">+</button>
      </div>
    </div>
  </div>`;
}

// New weight typed on set N carries forward to not-yet-done later sets.
function propagateWeight(ex, fromIndex) {
  const w = ex.sets[fromIndex].weightKg;
  for (let j = fromIndex + 1; j < ex.sets.length; j++) {
    if (!ex.sets[j].done) ex.sets[j].weightKg = w;
  }
}

function finishSession(active) {
  const sessions = load("sessions", []);
  sessions.push({
    id: uid(),
    planId: active.planId,
    planName: active.planName,
    date: localDate(active.startedAt),
    startedAt: active.startedAt,
    finishedAt: Date.now(),
    exercises: active.exercises.map((e) => ({
      exerciseId: e.exerciseId,
      name: e.name,
      mode: e.mode,
      targetSets: e.targetSets,
      targetRepsMin: e.targetRepsMin,
      targetRepsMax: e.targetRepsMax,
      // only checked sets are real history; targetSets keeps what was planned
      sets: e.sets.filter((s) => s.done).map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
    })),
  });
  save("sessions", sessions);

  // Progressive-overload helper: the plan remembers the last weight actually lifted.
  const plans = load("plans", []);
  const plan = plans.find((p) => p.id === active.planId);
  if (plan) {
    for (const e of active.exercises) {
      const doneSets = e.sets.filter((s) => s.done && s.weightKg != null);
      const planEx = plan.exercises.find((pe) => pe.id === e.exerciseId);
      if (planEx && doneSets.length) planEx.weightKg = doneSets[doneSets.length - 1].weightKg;
    }
    save("plans", plans);
  }

  const settings = load("settings", {});
  settings.lastPlanId = active.planId;
  save("settings", settings);
  save("activeSession", null);
}

export function renderSession(el, onExit) {
  const active = load("activeSession");
  if (!active) {
    onExit();
    return;
  }
  const total = active.exercises.length;
  const idx = Math.min(active.currentIndex, total - 1);
  const ex = active.exercises[idx];
  const isLast = idx === total - 1;
  const rerender = () => renderSession(el, onExit);
  const persist = () => save("activeSession", active);

  el.innerHTML = `
    <div class="session-head">
      <button class="icon-btn" data-action="cancel" aria-label="Zrušit trénink">✕</button>
      <div class="session-title">
        <strong>${escapeHtml(active.planName)}</strong>
        <span>Cvik ${idx + 1} z ${total}</span>
      </div>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${(idx / total) * 100}%"></div></div>

    <div class="card">
      <h3>${escapeHtml(ex.name)}</h3>
      ${ex.note ? `<p class="exercise-note">${escapeHtml(ex.note)}</p>` : ""}
      <p class="session-target">Cíl: ${targetText({ mode: ex.mode, sets: ex.targetSets, repsMin: ex.targetRepsMin, repsMax: ex.targetRepsMax })}</p>
      ${ex.howto ? `
      <details class="howto">
        <summary>📖 Jak na to</summary>
        <p>${escapeHtml(ex.howto).replace(/\n/g, "<br>")}</p>
      </details>` : ""}
    </div>

    ${ex.sets.map((s, i) => setCard(ex, s, i)).join("")}

    <div class="session-nav">
      <button class="btn btn-secondary" data-action="prev" ${idx === 0 ? "disabled" : ""}>← Zpět</button>
      ${isLast
        ? `<button class="btn btn-primary" data-action="finish">Dokončit ✔</button>`
        : `<button class="btn btn-primary" data-action="next">Další →</button>`}
    </div>`;

  el.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "adj") {
      const set = ex.sets[Number(btn.dataset.set)];
      const field = btn.dataset.field;
      const next = Math.max(0, (set[field] ?? 0) + parseFloat(btn.dataset.delta));
      set[field] = field === "reps" ? Math.round(next) : Math.round(next * 2) / 2;
      if (field === "weightKg") propagateWeight(ex, Number(btn.dataset.set));
      persist();
      rerender();
    } else if (action === "toggle") {
      const set = ex.sets[Number(btn.dataset.set)];
      set.done = !set.done;
      persist();
      rerender();
    } else if (action === "next") {
      active.currentIndex = idx + 1;
      persist();
      rerender();
    } else if (action === "prev") {
      active.currentIndex = idx - 1;
      persist();
      rerender();
    } else if (action === "cancel") {
      if (confirm("Zrušit rozdělaný trénink? Nic se neuloží.")) {
        save("activeSession", null);
        onExit();
      }
    } else if (action === "finish") {
      const doneCount = active.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
      if (doneCount === 0 && !confirm("Nemáš odškrtnutou žádnou sérii. Opravdu trénink uložit?")) return;
      finishSession(active);
      onExit();
    }
  };

  el.onchange = (e) => {
    const input = e.target.closest("input[data-field]");
    if (!input) return;
    const set = ex.sets[Number(input.dataset.set)];
    const field = input.dataset.field;
    const parsed = parseFloat(input.value);
    const value = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    set[field] = field === "reps" ? Math.round(value) : value;
    if (field === "weightKg") propagateWeight(ex, Number(input.dataset.set));
    persist();
    rerender();
  };
}
