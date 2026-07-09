// Storage layer: all app data lives in localStorage under the "ft." prefix.
// Future nutrition section adds its own keys (ft.foods, ft.mealLog, ft.nutritionTargets)
// plus a schema bump handled in initStorage() — nothing else changes.

const PREFIX = "ft.";
export const SCHEMA_VERSION = 1;

// Keys included in backup export/import. Grows with future schema versions.
const DATA_KEYS = ["plans", "sessions", "weights", "settings"];

export function load(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

// Runs once per page load: seeds an empty install, migrates old schemas.
export function initStorage(seedFn) {
  const meta = load("meta");
  if (!meta) {
    seedFn();
    save("meta", { schemaVersion: SCHEMA_VERSION });
    return;
  }
  // Future migrations, e.g.:
  // if (meta.schemaVersion < 2) { save("foods", []); ... save("meta", { schemaVersion: 2 }); }
}

export function exportAll() {
  const data = {
    app: "FitTrack",
    exportedAt: new Date().toISOString(),
    meta: load("meta"),
  };
  for (const key of DATA_KEYS) data[key] = load(key);
  return JSON.stringify(data, null, 2);
}

// Throws with a Czech message on invalid input; caller shows it to the user.
export function importAll(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    throw new Error("Soubor není platný JSON.");
  }
  if (data.app !== "FitTrack" || !data.meta || typeof data.meta.schemaVersion !== "number") {
    throw new Error("Tohle nevypadá jako záloha FitTracku.");
  }
  if (data.meta.schemaVersion > SCHEMA_VERSION) {
    throw new Error("Záloha je z novější verze aplikace — nejdřív aktualizuj appku.");
  }
  save("meta", data.meta);
  for (const key of DATA_KEYS) {
    if (data[key] != null) save(key, data[key]);
  }
}
