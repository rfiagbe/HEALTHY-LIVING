# Healthy Living

A personal health, nutrition, fasting, fitness and longevity companion. It runs entirely in the
browser — no account, no server, no data leaving the device — and installs on a phone as a home-screen
app that works offline.

It is not a calorie counter with a workout log bolted on. It is one plan: what to eat each day for
four weeks, what to buy in a single weekly shop, what to drink and when, when to open and close the
eating window, what to train, and which numbers to watch over years.

## What is in it

| Tab | What it does |
| --- | --- |
| **Today** | Live fasting-window countdown, the day's three meals with per-meal nutrition, a timed drink schedule, the day's training session, a habit checklist, and quick entry for weight, sleep, resting heart rate, steps, blood pressure and waist. |
| **Plan** | The full 4-week rotating menu — 28 days, 32 meals — with each day's calories, protein, fibre and food-group servings checked against the Dietary Guidelines pattern. |
| **Shop** | A bulk shopping list generated from the week's menus: exact quantities per aisle, with tick-off state that survives a reload. |
| **Train** | A 12-week home strength and aerobic programme (dumbbells and bodyweight), with set-by-set logging, weekly aerobic-minute tracking, progression rules and four-weekly fitness tests. |
| **Track** | Weight with a 7-day trend line, the healthy-BMI band, measured rate of loss, milestone projections, sleep and recovery markers, and a bloodwork table. |
| **Longevity** | The eight components of cardiovascular health, each scored against its own published target, plus a screening schedule, hydration and sleep routines. |
| **Sources** | Every source behind every number, what exactly is taken from each one, the arithmetic behind your personal targets, settings, and data export/import. |

## Nothing here is guessed

Every quantitative claim traces to a named public source, listed in `data/sources.json` and rendered
in the Sources tab:

- **Food-group targets, protein grams per kilogram, sodium, saturated fat, added sugar and the
  serving-size definitions** — [Dietary Guidelines for Americans, 2025–2030](https://realfood.gov/)
  (USDA/HHS, January 2026) and its
  [Daily Servings by Calorie Level](https://cdn.realfood.gov/Daily%20Serving%20Sizes_508.pdf) table.
- **Every calorie, protein, fibre, sodium, potassium, calcium and caffeine figure** —
  [USDA FoodData Central](https://fdc.nal.usda.gov/), SR Legacy. Each of the 107 foods in
  `data/foods.json` carries its FDC ID and the exact USDA description, so any number can be checked
  at source.
- **Aerobic and strength volume** — [Physical Activity Guidelines for Americans, 2nd
  edition](https://odphp.health.gov/sites/default/files/2019-09/Physical_Activity_Guidelines_2nd_edition.pdf)
  and [ACSM's 2026 resistance-training position stand](https://acsm.org/resistance-training-guidelines-update-2026/).
- **Fasting** — [Johns Hopkins Medicine](https://www.hopkinsmedicine.org/health/wellness-and-prevention/intermittent-fasting-what-is-it-and-how-does-it-work),
  [Mayo Clinic](https://www.mayoclinic.org/healthy-lifestyle/nutrition-and-healthy-eating/expert-answers/intermittent-fasting/faq-20441303)
  and [NIH](https://www.nih.gov/news-events/nih-research-matters/time-restricted-eating-metabolic-syndrome),
  including where the evidence is mixed and who should not do it.
- **Water and fibre** — National Academies Dietary Reference Intakes.
- **Sleep** — [AASM/SRS consensus](https://aasm.org/seven-or-more-hours-of-sleep-per-night-a-health-necessity-for-adults/)
  and CDC sleep guidance.
- **BMI, weight-loss pace, blood pressure, cholesterol and A1c thresholds** — CDC; waist
  circumference and the 5–10% weight-loss milestones — NHLBI.
- **The eight longevity components** — American Heart Association, Life's Essential 8. The app scores
  each component against its own published target; it does not reproduce AHA's 0–100 point algorithm.

The 28 planned days are verified numerically rather than by eye:

```bash
python tools/validate_plan.py
```

It recomputes every day from `data/foods.json` and fails if any day falls outside the calorie band,
the 1.2–1.6 g/kg protein range, the 38 g fibre floor, the 2,300 mg sodium ceiling or the saturated-fat
cap. All 28 days currently pass, averaging 1,985 kcal, 126 g protein, 45 g fibre, 18 g saturated fat
and 1,625 mg sodium a day.

## Running it

It is a static site with no build step. Because it loads its plan data over `fetch`, it needs to be
served rather than opened from the file system:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

### On a phone

Publish it with GitHub Pages, then install it from the browser:

1. On GitHub, go to **Settings → Pages**, set **Source** to *Deploy from a branch*, branch `main`,
   folder `/ (root)`, and save.
2. Wait a minute, then open the published URL on the phone.
3. **iPhone (Safari):** Share → *Add to Home Screen*. **Android (Chrome):** ⋮ → *Install app*.

It then behaves like a native app: full screen, its own icon, and it works with no signal because the
service worker caches the whole plan.

### Your own figures

The repository contains no personal data. On first run the app asks for date of birth, height, weight,
activity level, calorie gap and eating window, and keeps them in that browser's local storage.

For a local copy you can skip that by copying `data/profile.example.json` to `data/profile.json` and
filling it in — that path is in `.gitignore`, so it is never committed or published.

Everything you log lives in `localStorage` on the device. Use **Sources → Your data → Export a backup**
before clearing site data or moving to a new phone.

## Layout

```
index.html                 app shell
manifest.webmanifest       PWA manifest
sw.js                      service worker (network-first, cache as fallback)
assets/css/app.css         one stylesheet, light and dark
assets/js/
  app.js                   data loading, routing, first-run gate
  store.js                 localStorage state, export/import
  calc.js                  BMI, Mifflin-St Jeor, targets, trends, fasting clock, plan position
  nutrition.js             grams → meal/day/week totals and food-group servings
  ui.js                    HTML helpers and a dependency-free SVG chart
  views-core.js            Today, Plan, Shop
  views-more.js            Train, Track, Longevity, Sources, first-run setup
data/
  foods.json               107 foods, each with its USDA FDC ID and per-100 g nutrients
  meals.json               32 meals as gram-precise ingredient lists
  plan.json                4-week rotation, fasting protocol, drink schedule, trim options
  program.json             12-week training programme
  lifestyle.json           hydration, sleep, habits, longevity components, biomarkers, screening
  sources.json             every citation and what is taken from it
  profile.example.json     template for an untracked local profile
tools/
  build_food_table.py      rebuilds data/foods.json from the USDA bulk dataset
  food_picks.json          which USDA food each key maps to
  validate_plan.py         checks all 28 days against the targets
  make_icons.py            renders the PWA icons
```

### Rebuilding the food table

`data/foods.json` is generated, not hand-typed. To rebuild it from source, download the USDA
[SR Legacy CSV dataset](https://fdc.nal.usda.gov/download-datasets/) into `tools/usda/sr/` and run:

```bash
python tools/build_food_table.py build tools/food_picks.json data/foods.json
```

## A caveat worth repeating

This is a planner and a log built on public guidance. It is not medical advice, it cannot examine you,
and it knows nothing about your medical history or medications. Talk to a clinician before starting if
you take prescription medicine or have diabetes, heart disease, kidney disease or high blood pressure,
and do not use a fasting window if you have any history of disordered eating. Stop and seek advice for
chest pain, unusual breathlessness, fainting or persistent dizziness.
