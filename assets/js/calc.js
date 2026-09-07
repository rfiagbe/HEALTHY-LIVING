/* Every formula and threshold used in the app, in one place, each labelled with its source.
   Nothing here is invented: see data/sources.json for the full citation list. */

export const LB_PER_KG = 2.2046226218;
export const IN_PER_CM = 0.393700787;

export const GUIDE = {
  // Dietary Guidelines for Americans 2025-2030
  proteinPerKg: [1.2, 1.6],
  sodiumMaxMg: 2300,
  satFatPctMax: 0.10,
  addedSugarMaxPerMealG: 10,
  // NASEM Dietary Reference Intakes
  fiberG: 38,
  waterTotalMl: 3700,
  waterDrinksMl: 3000,
  // CDC / AASM / AHA
  bmiHealthy: [18.5, 24.9],
  lossLbPerWeek: [1, 2],
  sleepHours: [7, 9],
  aerobicMinutes: [150, 300],
  strengthDays: 2,
  caffeineMaxMg: 400,
  waistMaxIn: 40,
  vo2LowMen: 28,
  bp: { normalSys: 120, normalDia: 80, highSys: 130, highDia: 80 },
  lipids: { totalChol: 200, ldl: 100, hdlMin: 40, triglycerides: 150 },
  glucose: { fasting: 100, a1c: 5.7 },
  kcalPerLbFat: 3500   // the classic approximation, used only for rough projections
};

export const lbToKg = (lb) => lb / LB_PER_KG;
export const kgToLb = (kg) => kg * LB_PER_KG;
export const inToCm = (inches) => inches / IN_PER_CM;

export function todayIso(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return todayIso(d);
}

export function daysBetween(isoA, isoB) {
  const a = new Date(isoA + 'T12:00:00');
  const b = new Date(isoB + 'T12:00:00');
  return Math.round((b - a) / 86400000);
}

export function ageYears(dob, onIso = todayIso()) {
  const d = new Date(dob + 'T12:00:00');
  const on = new Date(onIso + 'T12:00:00');
  let age = on.getFullYear() - d.getFullYear();
  const m = on.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && on.getDate() < d.getDate())) age--;
  return age;
}

/** BMI from pounds and inches (CDC adult formula: 703 × lb / in²). */
export function bmi(lb, heightIn) {
  return (703 * lb) / (heightIn * heightIn);
}

/** CDC adult BMI categories. */
export function bmiCategory(value) {
  if (value < 18.5) return { label: 'Underweight', tone: 'warn' };
  if (value < 25) return { label: 'Healthy weight', tone: 'ok' };
  if (value < 30) return { label: 'Overweight', tone: 'warn' };
  if (value < 35) return { label: 'Obesity, class 1', tone: 'bad' };
  if (value < 40) return { label: 'Obesity, class 2', tone: 'bad' };
  return { label: 'Obesity, class 3', tone: 'bad' };
}

/** Pounds that correspond to a BMI at a given height. */
export function lbForBmi(target, heightIn) {
  return (target * heightIn * heightIn) / 703;
}

export function healthyRangeLb(heightIn) {
  return [lbForBmi(GUIDE.bmiHealthy[0], heightIn), lbForBmi(GUIDE.bmiHealthy[1], heightIn)];
}

/** Mifflin-St Jeor resting metabolic rate, the equation clinical practice defaults to. */
export function bmr({ lb, heightIn, age, sex }) {
  const kg = lbToKg(lb);
  const cm = inToCm(heightIn);
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

export const ACTIVITY = [
  { v: 1.2, label: 'Sedentary — desk job, little else' },
  { v: 1.375, label: 'Light — 1–3 sessions a week' },
  { v: 1.55, label: 'Moderate — 3–5 sessions a week' },
  { v: 1.725, label: 'High — 6–7 sessions a week' },
  { v: 1.9, label: 'Very high — physical job plus training' }
];

/** Everything personal, derived from profile + latest weight. */
export function targets(profile, weightLb) {
  const lb = weightLb || profile.startWeightLb;
  const age = ageYears(profile.dob);
  const rmr = bmr({ lb, heightIn: profile.heightIn, age, sex: profile.sex });
  const tdee = rmr * profile.activity;
  const kcal = Math.max(1500, Math.round((tdee - profile.deficitKcal) / 10) * 10);
  const kg = lbToKg(lb);
  const [range0, range1] = healthyRangeLb(profile.heightIn);
  const deficit = tdee - kcal;
  return {
    age,
    weightLb: lb,
    kg,
    bmi: bmi(lb, profile.heightIn),
    rmr: Math.round(rmr),
    tdee: Math.round(tdee),
    kcal,
    deficit: Math.round(deficit),
    lbPerWeek: (deficit * 7) / GUIDE.kcalPerLbFat,
    proteinG: [Math.round(kg * GUIDE.proteinPerKg[0]), Math.round(kg * GUIDE.proteinPerKg[1])],
    fiberG: GUIDE.fiberG,
    sodiumMaxMg: GUIDE.sodiumMaxMg,
    satFatMaxG: Math.round((kcal * GUIDE.satFatPctMax) / 9),
    waterMl: GUIDE.waterDrinksMl,
    healthyLb: [range0, range1],
    toHealthyLb: Math.max(0, lb - range1)
  };
}

/** 7-day (or n-day) moving average of the weight log — the number to trust over any single morning. */
export function weightTrend(weights, n = 7) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((w, i) => {
    const from = Math.max(0, i - n + 1);
    const slice = sorted.slice(from, i + 1);
    return { date: w.date, lb: w.lb, avg: slice.reduce((s, x) => s + x.lb, 0) / slice.length };
  });
}

/** Pounds per week from the last `days` of logged weights, using a least-squares slope. */
export function ratePerWeek(weights, days = 28) {
  if (weights.length < 4) return null;
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1].date;
  const window = sorted.filter((w) => daysBetween(w.date, last) <= days);
  if (window.length < 4) return null;
  const x0 = window[0].date;
  const xs = window.map((w) => daysBetween(x0, w.date));
  const ys = window.map((w) => w.lb);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const denom = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (!denom) return null;
  const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / denom;
  return slope * 7;
}

/** Weeks to a target weight at a given weekly rate (negative rate = losing). */
export function weeksTo(currentLb, targetLb, lbPerWeek) {
  if (!lbPerWeek || lbPerWeek >= 0) return null;
  const gap = currentLb - targetLb;
  if (gap <= 0) return 0;
  return gap / -lbPerWeek;
}

/* ---------- fasting window ---------- */

export function hhmmToMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minToLabel(min) {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ampm = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm}${ampm}`;
}

export function fastState(profile, now = new Date()) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const open = hhmmToMin(profile.eatFrom);
  const close = hhmmToMin(profile.eatTo);
  const eating = nowMin >= open && nowMin < close;
  if (eating) {
    return {
      eating: true,
      minsLeft: close - nowMin,
      label: 'Eating window open',
      detail: `Closes ${minToLabel(close)} · ${fmtDur(close - nowMin)} left`
    };
  }
  const until = nowMin < open ? open - nowMin : 1440 - nowMin + open;
  const fastedFor = nowMin >= close ? nowMin - close : 1440 - close + nowMin;
  return {
    eating: false,
    minsLeft: until,
    fastedMin: fastedFor,
    label: 'Fasting',
    detail: `${fmtDur(fastedFor)} fasted · opens ${minToLabel(open)}`
  };
}

export function fmtDur(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/* ---------- plan position ---------- */

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Which of the 4 rotation weeks, and which weekday, a given date maps to. */
export function planPosition(profile, iso = todayIso()) {
  const diff = Math.max(0, daysBetween(profile.planStart, iso));
  const weekIdx = ((Math.floor(diff / 7) % 4) + 4) % 4;
  const dayName = WEEKDAY[new Date(iso + 'T12:00:00').getDay()];
  return { weekIdx, weekNumber: weekIdx + 1, dayName, dayOfPlan: diff };
}

export function programWeek(profile, iso = todayIso()) {
  const diff = Math.max(0, daysBetween(profile.planStart, iso));
  return Math.floor(diff / 7) + 1;
}

export function phaseFor(program, week) {
  const w = ((week - 1) % 12) + 1;
  if (w <= 4) return program.phases[0];
  if (w <= 8) return program.phases[1];
  return program.phases[2];
}

/* ---------- small helpers ---------- */
export const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

export const clamp01 = (n) => Math.max(0, Math.min(1, n));

export function fmtDate(iso, opts = { weekday: 'long', month: 'short', day: 'numeric' }) {
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, opts);
}
