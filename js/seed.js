// Default data for a fresh install: Marek's plan A/B.
// Exercise modes: "reps" (target rep range), "amrap" (as many reps as possible),
// "time" (seconds instead of reps). weightKg: null = bodyweight exercise.
// howto: beginner-friendly technique cues, plain text, one cue per line.
// restSec: rest between sets; null falls back to the app default (90 s).
// Seed weights are placeholders — adjusted in the app via plan editing.

import { save } from "./storage.js";

const PLAN_A = {
  id: "plan-a",
  name: "Trénink A",
  exercises: [
    {
      id: "a1", name: "Dřep s osou na zádech", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 20, restSec: 120,
      note: "dlouhá osa",
      howto: "Osa leží na trapézech (svaly pod krkem), ne na samotném krku. Chodidla na šířku ramen, špičky mírně ven.\nZpevni břicho, hrudník drž nahoře a sedej dozadu a dolů jako na židli — kolena jdou ve směru špiček.\nDolů aspoň do rovnoběžky stehen se zemí, paty celou dobu na zemi. Nahoru se vytlač přes celá chodidla.\nPozor: nekulatit záda a nepouštět kolena dovnitř.",
    },
    {
      id: "a2", name: "Bench press na lavici", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 20, restSec: 120,
      note: "dlouhá osa",
      howto: "Lehni si, stáhni lopatky k sobě a dolů, chodidla pevně na zem.\nOsu spouštěj pomalu na spodní část hrudníku — lokty svírají s tělem zhruba 45°, ne roztažené kolmo do stran.\nVytlač vzhůru nad ramena, nahoře nezamykej lokty naplno.\nPozor: neodrážej osu od hrudníku, kontroluj celou dráhu pohybu.",
    },
    {
      id: "a3", name: "Přítahy na hrazdě podhmatem", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, restSec: 90,
      note: "dle síly: podhmat nebo australské přítahy",
      howto: "Uchop tyč podhmatem na šířku ramen a zpevni ramena už ve visu — netahej se z úplně povolených ramen.\nTáhni lokty dolů k tělu, až dostaneš bradu nad tyč, a pomalu se spusť zpátky.\nKdyž celé opakování ještě nedáš, dělej australské přítahy: nohy na zemi, tělo zpevněné v přímce, hrudník táhni k tyči.\nPozor: žádné kopání nohama a houpání.",
    },
    {
      id: "a4", name: "Tlaky na ramena vsedě", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 10, restSec: 90,
      note: "krátká osa nebo jednoručky",
      howto: "Seď zpříma, břicho zpevněné, činky (nebo osu) drž na úrovni ramen, předloktí míří svisle vzhůru.\nTlač nad hlavu do propnutých paží — ramena drž dole, netahej je k uším.\nDolů pomalu zpět k ramenům.\nPozor: neprohýbej se v bedrech — když to jinak nejde, je váha moc velká.",
    },
    {
      id: "a5", name: "Bradla", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, restSec: 90,
      note: "klidně s asistencí — nohy na zemi",
      howto: "Uchop madla, vytlač se nahoru a stáhni ramena dolů od uší, trup v mírném předklonu.\nSpouštěj se pokrčováním loktů — jdou dozadu podél těla, ne do stran — zhruba do pravého úhlu v lokti.\nPak se vytlač zpět nahoru.\nS asistencí: nech špičky nohou na zemi a dopomáhej si jen tolik, kolik potřebuješ.\nPozor: nespouštěj se hlouběji, než dovolí ramena bez bolesti.",
    },
    {
      id: "a6", name: "Plank", mode: "time", sets: 3, repsMin: 30, repsMax: 45, weightKg: null, restSec: 60,
      note: "",
      howto: "Předloktí na zemi přímo pod rameny, tělo tvoří přímku od hlavy k patám.\nZpevni břicho i hýždě a klidně dýchej.\nPozor: nezvedej zadek nahoru a neprověšuj bedra dolů — jakmile forma padá, ukonči sérii radši dřív.",
    },
  ],
};

const PLAN_B = {
  id: "plan-b",
  name: "Trénink B",
  exercises: [
    {
      id: "b1", name: "Rumunský mrtvý tah", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 30, restSec: 120,
      note: "dlouhá osa",
      howto: "Stoj, osa v natažených pažích u stehen, kolena mírně pokrčená — a tak už zůstanou celý cvik.\nTlač boky dozadu a nech osu sjíždět těsně podél stehen dolů, záda celou dobu rovná.\nJakmile ucítíš silný tah v zadní straně stehen (zhruba pod koleny), vrať se nahoru propnutím boků.\nPozor: není to dřep ani předklon s kulatými zády — pohyb vychází z boků a osa se drží u těla.",
    },
    {
      id: "b2", name: "Přítahy jednoručky v předklonu", mode: "reps", sets: 3, repsMin: 10, repsMax: 12, weightKg: 12.5, restSec: 90,
      note: "na každou ruku, opora o lavici",
      howto: "Klekni kolenem a opři se dlaní o lavici, druhá noha stojí na zemi — záda rovná, trup skoro vodorovně.\nČinku táhni loktem podél těla k boku (ne k rameni) a na konci stáhni lopatku.\nPomalu spusť dolů až do protažení.\nPozor: netoč trup — síla jde ze zad, ne ze švihu.",
    },
    {
      id: "b3", name: "Shyby na hrazdě", mode: "amrap", sets: 3, repsMin: null, repsMax: null, weightKg: null, restSec: 90,
      note: "případně negativní shyby",
      howto: "Uchop hrazdu nadhmatem o něco šíř než ramena a zpevni ramena už ve visu.\nTáhni lokty k tělu, až je brada nad tyčí, a pomalu se spusť.\nKdyž celý shyb ještě nedáš: vyskoč (nebo si stoupni) do horní pozice a spouštěj se co nejpomaleji, 3–5 sekund — to jsou negativní shyby.\nPozor: žádné houpání a škubání.",
    },
    {
      id: "b4", name: "Bulharské dřepy", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 10, restSec: 90,
      note: "na každou nohu, zadní noha na lavici",
      howto: "Stoupni si zády k lavici a polož na ni nárt zadní nohy; přední noha stojí dost daleko vepředu.\nKlesej rovně dolů — koleno zadní nohy míří k zemi, trup zpříma, váha na celém předním chodidle.\nPřes přední nohu se vytlač zpět nahoru.\nPozor: přední koleno jde ve směru špičky, nepředklánět se.",
    },
    {
      id: "b5", name: "Bicepsový zdvih s krátkou osou", mode: "reps", sets: 3, repsMin: 10, repsMax: 12, weightKg: 10, restSec: 60,
      note: "",
      howto: "Stoj, lokty přitisknuté k tělu, osu drž podhmatem.\nZvedej silou bicepsů k ramenům, nahoře krátce podrž a dolů pouštěj pomalu, skoro do propnutí.\nPozor: žádné houpání trupem a lokty zůstávají u těla — švih krade bicepsu práci.",
    },
    {
      id: "b6", name: "Zvedání nohou ve visu", mode: "reps", sets: 3, repsMin: 10, repsMax: 15, weightKg: null, restSec: 60,
      note: "na hrazdě, na břicho",
      howto: "Vis na hrazdě se zpevněnými rameny.\nZvedej pokrčená kolena k hrudníku (těžší varianta: natažené nohy nad úroveň boků) a na konci pohybu lehce podsaď pánev, ať zabírá břicho.\nDolů pouštěj pomalu, bez rozhoupání.\nPozor: když se začneš houpat, v klidu se mezi opakováními zastav.",
    },
  ],
};

export const SEED_PLANS = [PLAN_A, PLAN_B];

export function seedDefaultData() {
  save("plans", SEED_PLANS);
  save("sessions", []);
  save("weights", []);
  save("settings", { lastPlanId: null });
}
