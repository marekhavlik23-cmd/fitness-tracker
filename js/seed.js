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

const PLAN_C = {
  id: "plan-c",
  name: "Trénink C",
  exercises: [
    {
      id: "c1", name: "Hip thrust s osou", mode: "reps", sets: 3, repsMin: 10, repsMax: 12, weightKg: 20, restSec: 120,
      note: "dlouhá osa, podlož si ji přes boky ručníkem nebo podložkou",
      howto: "Sedni si zády opřený o lavici (lopatky na hraně lavice), osu polož přes boky.\nChodidla na šířku boků, blízko u sebe, paty pevně na zemi.\nZatlač přes paty a zvedni boky nahoru, až je tělo v jedné rovné linii od kolen po ramena — nahoře na chvíli sevři hýždě.\nPomalu se vrať dolů, boky se mezi opakováními nesmí dotknout země.\nPozor: neklop hlavu dozadu a nepřetahuj v bedrech nahoře — pohyb končí v rovné linii, ne v prohnutí.",
    },
    {
      id: "c2", name: "Tlak s dlouhou osou vestoje", mode: "reps", sets: 3, repsMin: 6, repsMax: 8, weightKg: 15, restSec: 120,
      note: "dlouhá osa",
      howto: "Stoj na šířku ramen, osu drž nadhmatem v úrovni klíčních kostí, lokty mírně vpředu.\nZpevni břicho a hýždě, ať se nezaklánějí záda, a vytlač osu nad hlavu do propnutých paží — hlavou lehce ustup, ať jde osa nahoru rovně.\nNahoře je osa nad středem chodidel, dolů spouštěj kontrolovaně zpět na ramena.\nPozor: netlač z prohnutých zad („bankování“) — když to jinak nejde, uber váhu.",
    },
    {
      id: "c3", name: "Přítahy osy v předklonu", mode: "reps", sets: 3, repsMin: 8, repsMax: 10, weightKg: 25, restSec: 120,
      note: "dlouhá osa",
      howto: "Stoj, kolena mírně pokrčená, předklon v bocích asi 45°, záda rovná, osu drž nadhmatem o něco šíř než ramena.\nTáhni osu k dolní části břicha, lokty jdou podél těla nahoru a dozadu, na konci stáhni lopatky k sobě.\nPomalu spouštěj zpět do natažených paží.\nPozor: netrhej váhu švihem trupu — pokud se musíš narovnávat, aby to vyšlo, uber váhu.",
    },
    {
      id: "c4", name: "Farmářská chůze", mode: "time", sets: 3, repsMin: 30, repsMax: 40, weightKg: 15, restSec: 90,
      note: "jednoručky v obou rukou, váha je na kus",
      howto: "Vezmi jednoručky do obou rukou — má to být citelně těžké, ale zvládnutelné — stoj vzpřímeně, ramena stažená dolů a dozadu.\nJdi vzpřímeně normálními kroky po dobu série, drž pevný úchop a nehrb se.\nNení dost místa na chůzi? Stůj na místě a jen drž váhu zpevněný po danou dobu.\nPozor: nenech ramena padat dopředu ani se naklánět na jednu stranu.",
    },
    {
      id: "c5", name: "Ruský zkrut s jednoručkou", mode: "reps", sets: 3, repsMin: 16, repsMax: 20, weightKg: 5, restSec: 60,
      note: "počet = obě strany dohromady",
      howto: "Seď na zemi, kolena pokrčená, chodidla na zemi, trup zakloněný asi 45° dozadu s rovnými zády.\nDrž jednoručku oběma rukama před tělem a otáčej trupem od boku k boku, jednoručku polož vedle boku na každé straně.\nPohyb jde z trupu, ne jen z rukou.\nPozor: nekulať dolní záda — pokud to jinak nejde, seď víc vzpřímeně.",
    },
    {
      id: "c6", name: "Výpony na lýtka s jednoručkami", mode: "reps", sets: 3, repsMin: 15, repsMax: 20, weightKg: 15, restSec: 60,
      note: "jednoručky podél těla",
      howto: "Stoj, jednoručky drž podél těla, špičky na vyvýšené hraně (schod, silná kniha), paty visí dolů — bez vyvýšení stačí i rovná podlaha.\nZvedni se co nejvýš na špičky, nahoře na chvíli podrž.\nPomalu klesej dolů, u vyvýšení až pod úroveň špiček pro plný rozsah.\nPozor: nehoupej se švihem, pohyb ať dělají lýtka, ne kolena.",
    },
  ],
};

export const SEED_PLANS = [PLAN_A, PLAN_B, PLAN_C];

// Starter food library — typical values per 100 g (raw unless noted otherwise).
// Real products vary by brand; these are a reasonable starting point Marek can
// edit, and he can always add his own alongside them.
export const SEED_FOODS = [
  // --- bílkoviny ---
  { id: "f1", name: "Kuřecí prsa, syrové", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { id: "f2", name: "Krůtí prsa, syrové", kcal: 157, protein: 29, carbs: 0, fat: 3.6 },
  { id: "f3", name: "Hovězí libové (svíčková), syrové", kcal: 143, protein: 21, carbs: 0, fat: 6 },
  { id: "f4", name: "Vepřová panenka, syrová", kcal: 143, protein: 21, carbs: 0, fat: 6 },
  { id: "f5", name: "Losos, syrový", kcal: 208, protein: 20, carbs: 0, fat: 13 },
  { id: "f6", name: "Tuňák ve vlastní šťávě (konzerva)", kcal: 116, protein: 26, carbs: 0, fat: 1 },
  { id: "f7", name: "Vejce slepičí", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { id: "f8", name: "Tvaroh měkký odtučněný", kcal: 78, protein: 13, carbs: 4, fat: 0.3 },
  { id: "f9", name: "Řecký jogurt bílý", kcal: 97, protein: 9, carbs: 4, fat: 5 },
  { id: "f10", name: "Skyr bílý", kcal: 63, protein: 11, carbs: 4, fat: 0.2 },
  { id: "f11", name: "Cottage sýr", kcal: 98, protein: 11, carbs: 3.4, fat: 4.3 },
  { id: "f12", name: "Syrovátkový protein (prášek)", kcal: 380, protein: 75, carbs: 8, fat: 6 },
  { id: "f13", name: "Čočka, vařená", kcal: 116, protein: 9, carbs: 20, fat: 0.4 },
  { id: "f14", name: "Cizrna, vařená", kcal: 164, protein: 9, carbs: 27, fat: 2.6 },
  // --- sacharidy ---
  { id: "f15", name: "Rýže bílá, vařená", kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 },
  { id: "f16", name: "Rýže basmati, vařená", kcal: 121, protein: 3.5, carbs: 25, fat: 0.4 },
  { id: "f17", name: "Brambory, vařené", kcal: 87, protein: 2, carbs: 20, fat: 0.1 },
  { id: "f18", name: "Těstoviny, vařené", kcal: 131, protein: 5, carbs: 25, fat: 1.1 },
  { id: "f19", name: "Ovesné vločky, syrové", kcal: 379, protein: 13, carbs: 68, fat: 7 },
  { id: "f20", name: "Chléb konzumní", kcal: 247, protein: 8, carbs: 49, fat: 1.5 },
  { id: "f21", name: "Chléb celozrnný", kcal: 219, protein: 9, carbs: 41, fat: 3 },
  { id: "f22", name: "Rohlík", kcal: 290, protein: 9, carbs: 57, fat: 2.5 },
  { id: "f23", name: "Banán", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { id: "f24", name: "Jablko", kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
  { id: "f25", name: "Rýžové chlebíčky", kcal: 387, protein: 8, carbs: 81, fat: 2.8 },
  // --- zelenina ---
  { id: "f26", name: "Brokolice, vařená", kcal: 35, protein: 2.4, carbs: 7, fat: 0.4 },
  { id: "f27", name: "Mrkev", kcal: 41, protein: 0.9, carbs: 10, fat: 0.2 },
  { id: "f28", name: "Rajče", kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2 },
  { id: "f29", name: "Okurka", kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1 },
  { id: "f30", name: "Špenát", kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4 },
  { id: "f31", name: "Paprika", kcal: 31, protein: 1, carbs: 6, fat: 0.3 },
  // --- tuky ---
  { id: "f32", name: "Olivový olej", kcal: 884, protein: 0, carbs: 0, fat: 100 },
  { id: "f33", name: "Máslo", kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 },
  { id: "f34", name: "Arašídové máslo", kcal: 588, protein: 25, carbs: 20, fat: 50 },
  { id: "f35", name: "Mandle", kcal: 579, protein: 21, carbs: 22, fat: 50 },
  { id: "f36", name: "Vlašské ořechy", kcal: 654, protein: 15, carbs: 14, fat: 65 },
  // --- mléčné ---
  { id: "f37", name: "Mléko polotučné 1,5 %", kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5 },
  { id: "f38", name: "Sýr eidam 30 %", kcal: 305, protein: 25, carbs: 0, fat: 22 },
];

export function seedDefaultData() {
  save("plans", SEED_PLANS);
  save("foods", SEED_FOODS);
  save("mealLog", []);
  save("nutritionTargets", null);
  save("sessions", []);
  save("weights", []);
  save("settings", { lastPlanId: null });
}
