// Nutrition view: daily food log grouped by meal, a personal food library
// (starter database + custom additions), a barcode scanner backed by the
// free Open Food Facts API, and daily kcal/macro targets with an optional
// calculator. Mirrors workout.js's structure: one file owns the view render
// plus all of its dialogs.

import { load, save, uid } from "../storage.js";
import { escapeHtml, fmtKg, todayStr, fmtDateFull, isoDate } from "../format.js";

const MEAL_TYPES = [
  { id: "breakfast", label: "Snídaně" },
  { id: "lunch", label: "Oběd" },
  { id: "dinner", label: "Večeře" },
  { id: "snack", label: "Svačina" },
];

let viewDate = todayStr();
let scanStream = null; // active camera MediaStream — must be stopped on tab switch/dialog close
let scanRafId = null;

// ---------- computation helpers ----------

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return isoDate(d);
}

function mealsForDate(date) {
  return load("mealLog", []).filter((m) => m.date === date);
}

function sumItems(items) {
  return items.reduce(
    (t, i) => ({
      kcal: t.kcal + (i.kcal || 0),
      protein: t.protein + (i.protein || 0),
      carbs: t.carbs + (i.carbs || 0),
      fat: t.fat + (i.fat || 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

function dayTotals(date) {
  return sumItems(mealsForDate(date).flatMap((m) => m.items));
}

function scaleFood(food, grams) {
  const factor = grams / 100;
  return {
    kcal: Math.round(food.kcal * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}

function addItemToMeal(date, mealType, item) {
  const mealLog = load("mealLog", []);
  let meal = mealLog.find((m) => m.date === date && m.mealType === mealType);
  if (!meal) {
    meal = { id: uid(), date, mealType, items: [] };
    mealLog.push(meal);
  }
  meal.items.push(item);
  save("mealLog", mealLog);
}

function removeItem(mealId, itemIndex) {
  const mealLog = load("mealLog", []);
  const meal = mealLog.find((m) => m.id === mealId);
  if (!meal) return;
  meal.items.splice(itemIndex, 1);
  // drop meals with no items left so the log doesn't accumulate empty rows
  save("mealLog", meal.items.length ? mealLog : mealLog.filter((m) => m.id !== meal.id));
}

// ---------- daily summary ----------

function macroBar(label, value, target, unit) {
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return `
    <div class="macro-row">
      <div class="macro-row-head">
        <span>${label}</span>
        <span>${Math.round(value)} / ${Math.round(target)} ${unit}</span>
      </div>
      <div class="macro-bar"><div class="macro-bar-fill" style="width:${pct}%"></div></div>
    </div>`;
}

function dailySummaryCard(totals, targets) {
  if (!targets) {
    return `
      <div class="card">
        <div class="card-head">
          <h3>Dnešní příjem</h3>
          <button class="btn-chip" data-action="open-targets">🎯 Nastavit cíl</button>
        </div>
        <p class="stat-value">${Math.round(totals.kcal)} <small>kcal</small></p>
        <p class="hint" style="margin-top:0">Bez cíle appka jen sčítá — nastav si ho a uvidíš i zbytek na den.</p>
      </div>`;
  }
  const remaining = targets.kcal - totals.kcal;
  return `
    <div class="card">
      <div class="card-head">
        <h3>Dnešní příjem</h3>
        <button class="btn-chip" data-action="open-targets">🎯 Cíl</button>
      </div>
      <p class="stat-value">${Math.round(totals.kcal)} <small>/ ${targets.kcal} kcal</small></p>
      <p class="goal-progress">${remaining >= 0 ? `Zbývá ${Math.round(remaining)} kcal` : `Překročeno o ${Math.round(-remaining)} kcal`}</p>
      ${macroBar("Bílkoviny", totals.protein, targets.protein, "g")}
      ${macroBar("Sacharidy", totals.carbs, targets.carbs, "g")}
      ${macroBar("Tuky", totals.fat, targets.fat, "g")}
    </div>`;
}

function dateNav() {
  const isToday = viewDate === todayStr();
  return `
    <div class="day-nav">
      <button class="icon-btn" data-action="day-prev" aria-label="Předchozí den">←</button>
      <button class="day-nav-label" data-action="day-today">${isToday ? "Dnes" : fmtDateFull(viewDate)}</button>
      <button class="icon-btn" data-action="day-next" aria-label="Další den" ${isToday ? "disabled" : ""}>→</button>
    </div>`;
}

function mealItemRow(meal, item, idx) {
  const detail = item.grams != null ? `${item.grams} g · ` : "";
  const proteinPart = item.protein ? ` · B ${fmtKg(item.protein)} g` : "";
  return `
    <div class="meal-item-row">
      <div>
        <span class="meal-item-name">${escapeHtml(item.name)}</span>
        <span class="meal-item-detail">${detail}${item.kcal} kcal${proteinPart}</span>
      </div>
      <button class="btn-icon-sm" data-action="del-item" data-meal="${meal.id}" data-idx="${idx}" aria-label="Smazat položku">🗑️</button>
    </div>`;
}

function mealCard(mealType, meal) {
  const items = meal ? meal.items : [];
  const totals = sumItems(items);
  return `
    <div class="card">
      <div class="card-head">
        <h3>${mealType.label}</h3>
        <span class="exercise-target">${items.length ? `${Math.round(totals.kcal)} kcal` : ""}</span>
      </div>
      ${items.length ? items.map((it, i) => mealItemRow(meal, it, i)).join("") : `<p class="hint" style="margin-top:0">Zatím nic.</p>`}
      <button class="btn btn-secondary btn-small" data-action="add-food" data-meal-type="${mealType.id}">+ Přidat</button>
    </div>`;
}

// ---------- shared: food detail (grams entry + macro preview + add) ----------
// Used both by the library-search tab and the barcode-scan result — boxId
// picks which container to render into so the two tabs don't collide.

function renderFoodDetail(food, boxId, mealType, onAdded, opts = {}) {
  const box = document.getElementById(boxId);
  box.hidden = false;
  box.innerHTML = `
    <p class="food-detail-name">${escapeHtml(food.name)}</p>
    <label class="field">Gramáž (g)
      <input type="number" id="${boxId}-grams" inputmode="numeric" min="1" max="2000" value="100">
    </label>
    <p class="food-detail-macros" id="${boxId}-macros"></p>
    ${opts.offerSave ? `
    <label class="field-checkbox">
      <input type="checkbox" id="${boxId}-save" checked> Uložit i do mé knihovny potravin
    </label>` : ""}
    <button type="button" class="btn btn-primary" id="${boxId}-add-btn">Přidat</button>`;

  const gramsInput = document.getElementById(`${boxId}-grams`);
  const macrosEl = document.getElementById(`${boxId}-macros`);
  const updateMacros = () => {
    const grams = Number(gramsInput.value) || 0;
    const s = scaleFood(food, grams);
    macrosEl.textContent = `${s.kcal} kcal · B ${fmtKg(s.protein)} g · S ${fmtKg(s.carbs)} g · T ${fmtKg(s.fat)} g`;
  };
  updateMacros();
  gramsInput.oninput = updateMacros;

  document.getElementById(`${boxId}-add-btn`).onclick = () => {
    const grams = Number(gramsInput.value) || 0;
    if (grams <= 0) return;
    const scaled = scaleFood(food, grams);

    if (opts.offerSave && document.getElementById(`${boxId}-save`).checked) {
      const foods = load("foods", []);
      foods.push(food);
      save("foods", foods);
    }
    addItemToMeal(viewDate, mealType, { foodId: food.id, name: food.name, grams, ...scaled });
    onAdded();
  };
}

// ---------- food library edit dialog (shared: new / edit) ----------

function openFoodEditDialog(food, onSaved) {
  const dialog = document.getElementById("food-edit-dialog");
  document.getElementById("food-edit-title").textContent = food ? "Upravit potravinu" : "Nová potravina";
  const f = {
    name: document.getElementById("fe-name"),
    kcal: document.getElementById("fe-kcal"),
    protein: document.getElementById("fe-protein"),
    carbs: document.getElementById("fe-carbs"),
    fat: document.getElementById("fe-fat"),
  };
  f.name.value = food?.name ?? "";
  f.kcal.value = food?.kcal ?? "";
  f.protein.value = food?.protein ?? "";
  f.carbs.value = food?.carbs ?? "";
  f.fat.value = food?.fat ?? "";

  document.getElementById("food-edit-form").onsubmit = (e) => {
    e.preventDefault();
    const values = {
      name: f.name.value.trim(),
      kcal: Number(f.kcal.value),
      protein: Number(f.protein.value),
      carbs: Number(f.carbs.value),
      fat: Number(f.fat.value),
    };
    if (!values.name) return;
    const foods = load("foods", []);
    if (food) {
      Object.assign(food, values);
      save("foods", foods.map((x) => (x.id === food.id ? food : x)));
    } else {
      foods.push({ id: uid(), ...values });
      save("foods", foods);
    }
    dialog.close();
    onSaved();
  };
  document.getElementById("fe-cancel").onclick = () => dialog.close();
  dialog.showModal();
}

// ---------- "Moje potraviny" library browser ----------

function openFoodsListDialog() {
  const dialog = document.getElementById("foods-list-dialog");
  const searchInput = document.getElementById("foods-list-search");
  const body = document.getElementById("foods-list-body");

  const renderList = () => {
    const foods = load("foods", []);
    const q = searchInput.value.trim().toLowerCase();
    const matches = (q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "cs"));
    body.innerHTML = matches.length
      ? matches.map((f) => `
        <div class="food-result-row food-manage-row">
          <div>
            <span>${escapeHtml(f.name)}</span>
            <span class="food-result-kcal">${f.kcal} kcal · B${fmtKg(f.protein)} S${fmtKg(f.carbs)} T${fmtKg(f.fat)}</span>
          </div>
          <button type="button" class="btn-icon-sm" data-edit-food="${f.id}" aria-label="Upravit potravinu">✏️</button>
          <button type="button" class="btn-icon-sm" data-del-food="${f.id}" aria-label="Smazat potravinu">🗑️</button>
        </div>`).join("")
      : `<p class="hint">Nic nenalezeno.</p>`;
  };

  searchInput.value = "";
  renderList();
  searchInput.oninput = renderList;

  body.onclick = (e) => {
    const editBtn = e.target.closest("[data-edit-food]");
    const delBtn = e.target.closest("[data-del-food]");
    if (editBtn) {
      const food = load("foods", []).find((f) => f.id === editBtn.dataset.editFood);
      if (food) openFoodEditDialog(food, renderList);
    } else if (delBtn) {
      const food = load("foods", []).find((f) => f.id === delBtn.dataset.delFood);
      if (food && confirm(`Smazat potravinu „${food.name}“ z knihovny? Už zapsaná jídla to neovlivní.`)) {
        save("foods", load("foods", []).filter((f) => f.id !== food.id));
        renderList();
      }
    }
  };

  document.getElementById("foods-list-add-new").onclick = () => openFoodEditDialog(null, renderList);
  document.getElementById("foods-list-close").onclick = () => dialog.close();
  dialog.showModal();
}

// ---------- barcode scanner (native BarcodeDetector + Open Food Facts) ----------

function stopScanner() {
  if (scanRafId) cancelAnimationFrame(scanRafId);
  scanRafId = null;
  if (scanStream) {
    scanStream.getTracks().forEach((t) => t.stop());
    scanStream = null;
  }
}

// Wired once at module load (app.js's <script type="module"> runs after the
// dialog markup has already been parsed). Guarantees the camera stops even
// if the user dismisses the dialog with Esc rather than a button.
document.getElementById("food-dialog")?.addEventListener("close", stopScanner);

async function lookupBarcode(code, mealType, onAdded) {
  const statusEl = document.getElementById("scan-status");
  const resultBox = document.getElementById("scan-result");
  resultBox.hidden = true;
  statusEl.textContent = `Hledám kód ${code}…`;
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) {
      statusEl.textContent = "Produkt s tímto kódem se v databázi nenašel. Zkus ho přidat ručně.";
      return;
    }
    const n = data.product.nutriments || {};
    const food = {
      id: uid(),
      name: data.product.product_name || data.product.generic_name || `Produkt ${code}`,
      kcal: Math.round(n["energy-kcal_100g"] ?? 0),
      protein: Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
      carbs: Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
      fat: Math.round((n["fat_100g"] ?? 0) * 10) / 10,
    };
    statusEl.textContent = "";
    renderFoodDetail(food, "scan-result", mealType, onAdded, { offerSave: true });
  } catch {
    statusEl.textContent = "Vyhledání se nepovedlo — zkontroluj připojení, nebo zadej potravinu ručně v knihovně.";
  }
}

async function startScanner(mealType, onAdded) {
  const video = document.getElementById("scan-video");
  const cameraWrap = document.getElementById("scan-camera-wrap");
  const unsupportedBox = document.getElementById("scan-unsupported");
  document.getElementById("scan-status").textContent = "";
  document.getElementById("scan-result").hidden = true;

  if (!("BarcodeDetector" in window)) {
    unsupportedBox.hidden = false;
    cameraWrap.hidden = true;
    return;
  }
  unsupportedBox.hidden = true;
  cameraWrap.hidden = false;

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = scanStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });

    const tick = async () => {
      if (!scanStream) return; // stopped from elsewhere (tab switch, dialog close)
      try {
        const codes = await detector.detect(video);
        if (codes.length) {
          const code = codes[0].rawValue;
          stopScanner();
          await lookupBarcode(code, mealType, onAdded);
          return;
        }
      } catch {
        // transient decode error on this frame — keep scanning
      }
      scanRafId = requestAnimationFrame(tick);
    };
    scanRafId = requestAnimationFrame(tick);
  } catch {
    document.getElementById("scan-status").textContent =
      "Nepodařilo se spustit kameru — zkontroluj oprávnění, nebo zadej kód ručně.";
  }
}

// ---------- add-food dialog (search / quick / scan tabs) ----------

function openFoodDialog(mealType, el) {
  const dialog = document.getElementById("food-dialog");
  const mealLabel = MEAL_TYPES.find((m) => m.id === mealType).label;
  document.getElementById("food-dialog-title").textContent = `Přidat do: ${mealLabel}`;

  const closeAndRefresh = () => {
    stopScanner();
    dialog.close();
    renderNutrition(el);
  };

  // --- tabs ---
  const switchTab = (tab) => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    document.getElementById("food-tab-search").hidden = tab !== "search";
    document.getElementById("food-tab-quick").hidden = tab !== "quick";
    document.getElementById("food-tab-scan").hidden = tab !== "scan";
    if (tab === "scan") startScanner(mealType, closeAndRefresh);
    else stopScanner();
  };
  document.querySelectorAll(".tab-btn").forEach((b) => {
    b.onclick = () => switchTab(b.dataset.tab);
  });

  // --- search tab ---
  const searchInput = document.getElementById("food-search-input");
  const resultsBox = document.getElementById("food-search-results");
  document.getElementById("food-search-detail").hidden = true;

  const renderResults = () => {
    const foods = load("foods", []);
    const q = searchInput.value.trim().toLowerCase();
    const matches = (q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods).slice(0, 30);
    resultsBox.innerHTML = matches.length
      ? matches.map((f) => `
        <button type="button" class="food-result-row" data-food="${f.id}">
          <span>${escapeHtml(f.name)}</span>
          <span class="food-result-kcal">${f.kcal} kcal/100g</span>
        </button>`).join("")
      : `<p class="hint">Nic nenalezeno.</p>`;
    resultsBox.querySelectorAll("[data-food]").forEach((row) => {
      row.onclick = () => {
        const food = foods.find((x) => x.id === row.dataset.food);
        renderFoodDetail(food, "food-search-detail", mealType, closeAndRefresh);
      };
    });
  };
  searchInput.value = "";
  renderResults();
  searchInput.oninput = renderResults;
  document.getElementById("food-add-new-btn").onclick = () => openFoodEditDialog(null, renderResults);

  // --- quick tab ---
  document.getElementById("quick-name").value = "";
  document.getElementById("quick-kcal").value = "";
  document.getElementById("quick-protein").value = "";
  document.getElementById("quick-add-btn").onclick = () => {
    const name = document.getElementById("quick-name").value.trim() || mealLabel;
    const kcal = Number(document.getElementById("quick-kcal").value);
    const proteinRaw = document.getElementById("quick-protein").value.trim();
    if (!Number.isFinite(kcal) || kcal <= 0) {
      alert("Zadej platné kalorie.");
      return;
    }
    addItemToMeal(viewDate, mealType, {
      foodId: null, name, grams: null,
      kcal: Math.round(kcal), protein: proteinRaw === "" ? 0 : Number(proteinRaw), carbs: 0, fat: 0,
    });
    closeAndRefresh();
  };

  // --- scan tab ---
  document.getElementById("scan-manual-code").value = "";
  document.getElementById("scan-manual-lookup").onclick = () => {
    const code = document.getElementById("scan-manual-code").value.trim();
    if (code) lookupBarcode(code, mealType, closeAndRefresh);
  };

  document.getElementById("food-dialog-close").onclick = () => dialog.close();
  switchTab("search");
  dialog.showModal();
}

// ---------- targets dialog + calculator ----------

function openTargetsDialog(el) {
  const dialog = document.getElementById("targets-dialog");
  const targets = load("nutritionTargets");
  document.getElementById("tg-kcal").value = targets?.kcal ?? "";
  document.getElementById("tg-protein").value = targets?.protein ?? "";
  document.getElementById("tg-carbs").value = targets?.carbs ?? "";
  document.getElementById("tg-fat").value = targets?.fat ?? "";

  const settings = load("settings", {});
  document.getElementById("calc-height").value = settings.heightCm ?? "";
  document.getElementById("calc-age").value = settings.age ?? "";
  document.getElementById("calc-sex").value = settings.sex ?? "m";
  document.getElementById("calc-activity").value = settings.activityLevel ?? "1.55";
  document.getElementById("calc-explain").textContent = "";

  document.getElementById("calc-apply-btn").onclick = () => {
    const heightCm = Number(document.getElementById("calc-height").value);
    const age = Number(document.getElementById("calc-age").value);
    const sex = document.getElementById("calc-sex").value;
    const activity = Number(document.getElementById("calc-activity").value);
    const weights = load("weights", []);
    const weightKg = weights.length ? weights[weights.length - 1].kg : null;

    if (!heightCm || !age || !weightKg) {
      document.getElementById("calc-explain").textContent =
        "Pro výpočet potřebuju výšku, věk a aspoň jeden zápis váhy (sekce Váha).";
      return;
    }

    const s = load("settings", {});
    s.heightCm = heightCm;
    s.age = age;
    s.sex = sex;
    s.activityLevel = activity;
    save("settings", s);

    // Mifflin-St Jeor BMR -> TDEE -> mírný deficit/přebytek dle cílové váhy (sekce Váha).
    const bmr = sex === "f" ? 10 * weightKg + 6.25 * heightCm - 5 * age - 161 : 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    const tdee = bmr * activity;

    let kcalTarget = tdee;
    let goalNote = "udržovací příjem";
    if (s.targetWeightKg != null && Math.abs(s.targetWeightKg - weightKg) > 0.5) {
      if (s.targetWeightKg < weightKg) {
        kcalTarget = tdee - 500;
        goalNote = "mírný deficit (~0,5 kg/týden hubnutí)";
      } else {
        kcalTarget = tdee + 300;
        goalNote = "mírný přebytek pro nabírání";
      }
    }
    kcalTarget = Math.round(kcalTarget / 10) * 10;

    const proteinG = Math.round(weightKg * 2.0);
    const fatKcal = kcalTarget * 0.25;
    const fatG = Math.round(fatKcal / 9);
    const carbsG = Math.round(Math.max(0, kcalTarget - proteinG * 4 - fatKcal) / 4);

    document.getElementById("tg-kcal").value = kcalTarget;
    document.getElementById("tg-protein").value = proteinG;
    document.getElementById("tg-carbs").value = carbsG;
    document.getElementById("tg-fat").value = fatG;
    document.getElementById("calc-explain").textContent = `Odhad z tvé váhy ${fmtKg(weightKg)} kg: ${goalNote}. Čísla si klidně uprav ručně.`;
  };

  document.getElementById("targets-form").onsubmit = (e) => {
    e.preventDefault();
    save("nutritionTargets", {
      kcal: Number(document.getElementById("tg-kcal").value),
      protein: Number(document.getElementById("tg-protein").value),
      carbs: Number(document.getElementById("tg-carbs").value),
      fat: Number(document.getElementById("tg-fat").value),
    });
    dialog.close();
    renderNutrition(el);
  };
  document.getElementById("tg-cancel").onclick = () => dialog.close();
  dialog.showModal();
}

// ---------- main render ----------

export function renderNutrition(el) {
  const totals = dayTotals(viewDate);
  const targets = load("nutritionTargets");
  const meals = mealsForDate(viewDate);

  el.innerHTML = `
    <h2>Jídelníček</h2>
    ${dateNav()}
    ${dailySummaryCard(totals, targets)}
    ${MEAL_TYPES.map((mt) => mealCard(mt, meals.find((m) => m.mealType === mt.id))).join("")}
    <button class="btn btn-secondary" data-action="open-foods-list">📋 Moje potraviny</button>`;

  el.onclick = (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === "day-prev") {
      viewDate = shiftDate(viewDate, -1);
      renderNutrition(el);
    } else if (action === "day-next") {
      viewDate = shiftDate(viewDate, 1);
      renderNutrition(el);
    } else if (action === "day-today") {
      viewDate = todayStr();
      renderNutrition(el);
    } else if (action === "add-food") {
      openFoodDialog(btn.dataset.mealType, el);
    } else if (action === "del-item") {
      removeItem(btn.dataset.meal, Number(btn.dataset.idx));
      renderNutrition(el);
    } else if (action === "open-targets") {
      openTargetsDialog(el);
    } else if (action === "open-foods-list") {
      openFoodsListDialog();
    }
  };
}
