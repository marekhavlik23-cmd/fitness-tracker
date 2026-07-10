# FitTrack

Osobní tréninkový deník jako mobile-first PWA — tréninky A/B s odškrtáváním sérií,
historie výkonů a sledování tělesné váhy. Bez backendu: všechna data žijí
v localStorage prohlížeče, offline funkčnost přes service worker.

## Spuštění pro vývoj

Service worker vyžaduje HTTPS nebo localhost:

```
py -3 -m http.server 8173
```

a otevřít http://localhost:8173.

## Struktura

- `index.html` — jediná stránka (SPA), sekce Trénink / Váha / Jídelníček
- `js/storage.js` — vrstva nad localStorage (prefix `ft.`, verze schématu, export/import zálohy)
- `js/seed.js` — výchozí tréninkové plány A/B při první instalaci
- `js/views/` — jednotlivé sekce UI
- `sw.js` — service worker (network-first, offline fallback z cache)
- `tools/make_icons.py` — generátor PWA ikon (vyžaduje Pillow)

## Stav

- [x] Fáze 1 — kostra appky: navigace, PWA (manifest + SW + ikony), úložiště se seed daty, záloha/obnova JSON
- [x] Fáze 2 — Trénink: editace plánů, „Start tréninku“ mód s popisy techniky, historie
- [x] Fáze 3 — Váha: zápis, graf, trend
- [ ] Fáze 4 — nasazení (GitHub Pages) + instalace na telefon
- [ ] Později — Jídelníček (schéma v2: `ft.foods`, `ft.mealLog`, `ft.nutritionTargets`)
