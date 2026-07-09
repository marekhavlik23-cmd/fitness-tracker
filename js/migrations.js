// Schema migrations, keyed by target version. initStorage() runs them in order
// on installs older than the current SCHEMA_VERSION.

import { load, save } from "./storage.js";
import { SEED_PLANS } from "./seed.js";

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
};
