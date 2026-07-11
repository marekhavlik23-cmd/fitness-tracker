// Schema migrations, keyed by target version. initStorage() runs them in order
// on installs older than the current SCHEMA_VERSION.

import { load, save } from "./storage.js";
import { SEED_PLANS, SEED_FOODS } from "./seed.js";

export const MIGRATIONS = {
  // v2: exercises gained a "howto" technique field. Backfill seed exercises
  // (matched by id) with the seed texts, custom exercises get an empty string.
  2: () => {
    const seedHowto = new Map();
    for (const plan of SEED_PLANS) {
      for (const ex of plan.exercises) seedHowto.set(ex.id, ex.howto);
    }
    const plans = load("plans", []);
    for (const plan of plans) {
      for (const ex of plan.exercises) {
        if (ex.howto == null) ex.howto = seedHowto.get(ex.id) ?? "";
      }
    }
    save("plans", plans);
  },

  // v3: exercises gained "restSec" (rest between sets). Backfill seed exercises
  // by id; custom exercises stay null and use the app default.
  3: () => {
    const seedRest = new Map();
    for (const plan of SEED_PLANS) {
      for (const ex of plan.exercises) seedRest.set(ex.id, ex.restSec);
    }
    const plans = load("plans", []);
    for (const plan of plans) {
      for (const ex of plan.exercises) {
        if (ex.restSec === undefined) ex.restSec = seedRest.get(ex.id) ?? null;
      }
    }
    save("plans", plans);
  },

  // v4: added Trénink C (functional third full-body day — hip thrust, standing
  // press, barbell row, farmer's carry, rotational core, calves). Append it to
  // existing installs; the id check just makes this migration idempotent.
  4: () => {
    const plans = load("plans", []);
    if (!plans.some((p) => p.id === "plan-c")) {
      const planC = SEED_PLANS.find((p) => p.id === "plan-c");
      if (planC) {
        plans.push(planC);
        save("plans", plans);
      }
    }
  },

  // v5: Jídelníček — added ft.foods (starter library) and ft.mealLog.
  // ft.nutritionTargets needs no migration: load() already returns null for a
  // missing key, same as an explicit "not set yet" — nothing to initialize.
  5: () => {
    if (load("foods") == null) save("foods", SEED_FOODS);
    if (load("mealLog") == null) save("mealLog", []);
  },
};
