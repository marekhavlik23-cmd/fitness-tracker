// Small shared formatting helpers (Czech UI strings).

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Czech decimal comma for display (inputs keep the dot).
export function fmtKg(value) {
  return String(value).replace(".", ",");
}

// ex: { mode, sets, repsMin, repsMax }
export function targetText(ex) {
  if (ex.mode === "amrap") return `${ex.sets}× max`;
  if (ex.mode === "time") return `${ex.sets}× ${ex.repsMin}–${ex.repsMax} s`;
  return `${ex.sets}× ${ex.repsMin}–${ex.repsMax}`;
}

export function weightText(ex) {
  return ex.weightKg == null ? "vlastní váha" : `${fmtKg(ex.weightKg)} kg`;
}

// One logged set for history rows, e.g. "20 kg × 10", "12 op.", "35 s".
export function setSummary(mode, set) {
  if (mode === "time") return `${set.reps} s`;
  if (set.weightKg != null) return `${fmtKg(set.weightKg)} kg × ${set.reps}`;
  return `${set.reps} op.`;
}

// Local YYYY-MM-DD (not UTC — late-evening workouts must keep their day).
export function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function localDate(ts) {
  return isoDate(new Date(ts));
}

export function todayStr() {
  return isoDate(new Date());
}

export function fmtSessionDate(ts) {
  return new Date(ts).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
}

// Formatters for plain "YYYY-MM-DD" date strings (weight entries, session.date).
export function fmtDateShort(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

export function fmtDateFull(dateStr) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("cs-CZ", { weekday: "short", day: "numeric", month: "numeric" });
}
