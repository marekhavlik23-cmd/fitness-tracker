// Default data for a fresh install: Marek's plan A/B.
// Exercise modes: "reps" (target rep range), "amrap" (as many reps as possible),
// "time" (seconds instead of reps). weightKg: null = bodyweight exercise.
// Seed weights are placeholders — adjusted in the app (plan editing, phase 2).

import { save } from "./storage.js";

const PLAN_A = {
  id: "plan-a",
  name: "Trénink A",
  exercises: [
    { id: "a1", name: "Dřep s osou na zádech", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 20, note: "dlouhá osa" },
    { id: "a2", name: "Bench press na lavici", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 20, note: "dlouhá osa" },
    { id: "a3", name: "Přítahy na hrazdě podhmatem", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, note: "dle síly: podhmat nebo australské přítahy" },
    { id: "a4", name: "Tlaky na ramena vsedě", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 10, note: "krátká osa nebo jednoručky" },
    { id: "a5", name: "Bradla", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, note: "klidně s asistencí — nohy na zemi" },
    { id: "a6", name: "Plank", mode: "time", sets: 3, repsMin: 30, repsMax: 45, weightKg: null, note: "" },
  ],
};

const PLAN_B = {
  id: "plan-b",
  name: "Trénink B",
  exercises: [
    { id: "b1", name: "Rumunský mrtvý tah", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 30, note: "dlouhá osa" },
    { id: "b2", name: "Přítahy jednoručky v předklonu", mode: "reps", sets: 3, repsMin: 10, repsMax: 12, weightKg: 12.5, note: "na každou ruku, opora o lavici" },
    { id: "b3", name: "Shyby na hrazdě", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, note: "případně negativní shyby" },
    { id: "b4", name: "Bulharské dřepy", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 10, note: "na každou nohu, zadní noha na lavici" },
    { id: "b5", name: "Bicepsový zdvih s krátkou osou", mode: "reps", sets: 3, repsMin: 10, repsMax: 12, weightKg: 10, note: "" },
    { id: "b6", name: "Zvedání nohou ve visu", mode: "reps", sets: 3, repsMin: 10, repsMax: 15, weightKg: null, note: "na hrazdě, na břicho" },
  ],
};

export function seedDefaultData() {
  save("plans", [PLAN_A, PLAN_B]);
  save("sessions", []);
  save("weights", []);
  save("settings", { lastPlanId: null });
}
