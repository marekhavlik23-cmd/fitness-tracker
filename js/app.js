// App entry: storage init, hash-based navigation, settings dialog, SW registration.

import { initStorage, exportAll, importAll, SCHEMA_VERSION } from "./storage.js";
import { seedDefaultData } from "./seed.js";
import { MIGRATIONS } from "./migrations.js";
import { renderWorkout } from "./views/workout.js";
import { renderWeight } from "./views/weight.js";
import { renderNutrition } from "./views/nutrition.js";

export const APP_VERSION = "0.2.0";

const VIEWS = {
  workout: { hash: "#trenink", render: renderWorkout },
  weight: { hash: "#vaha", render: renderWeight },
  nutrition: { hash: "#jidelnicek", render: renderNutrition },
};

function viewNameFromHash() {
  const hash = location.hash;
  for (const [name, view] of Object.entries(VIEWS)) {
    if (view.hash === hash) return name;
  }
  return "workout";
}

function switchView(name) {
  for (const [viewName, view] of Object.entries(VIEWS)) {
    const el = document.getElementById(`view-${viewName}`);
    const active = viewName === name;
    el.hidden = !active;
    if (active) view.render(el);
  }
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === name);
  });
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      location.hash = VIEWS[btn.dataset.view].hash;
    });
  });
  window.addEventListener("hashchange", () => switchView(viewNameFromHash()));
}

function setupSettings() {
  const dialog = document.getElementById("settings-dialog");
  const meta = document.getElementById("settings-meta");

  document.getElementById("btn-settings").addEventListener("click", () => {
    meta.textContent = `FitTrack v${APP_VERSION} · schéma dat v${SCHEMA_VERSION}`;
    dialog.showModal();
  });
  document.getElementById("btn-settings-close").addEventListener("click", () => dialog.close());

  document.getElementById("btn-export").addEventListener("click", () => {
    const blob = new Blob([exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fittrack-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById("input-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    if (!confirm("Obnovení ze zálohy PŘEPÍŠE všechna aktuální data v appce. Pokračovat?")) return;
    try {
      importAll(await file.text());
      alert("Data obnovena ze zálohy.");
      location.reload();
    } catch (err) {
      alert(`Import se nepovedl: ${err.message}`);
    }
  });
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((err) => {
      console.warn("Service worker se nezaregistroval:", err);
    });
  }
}

initStorage(seedDefaultData, MIGRATIONS);
setupNavigation();
setupSettings();
switchView(viewNameFromHash());
registerServiceWorker();
