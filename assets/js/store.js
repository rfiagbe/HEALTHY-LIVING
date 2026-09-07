/* Local state. Everything lives in this browser — no account, no server, no data leaves the device. */

const KEY = 'healthy-living-v1';

/* Neutral defaults only. Your own figures are either entered once on the device (they stay in this
   browser and are never committed) or supplied by an untracked data/profile.json for a local copy. */
export const DEFAULT_PROFILE = {
  sex: 'male',
  dob: '1990-01-01',
  heightIn: 68,
  startWeightLb: 180,
  startDate: new Date().toISOString().slice(0, 10),
  activity: 1.375,          // "light" — desk job plus the 3-day training week
  deficitKcal: 500,         // about 1 lb a week
  eatFrom: '12:00',
  eatTo: '20:00',
  wake: '06:30',
  bed: '22:30',
  planStart: mondayOfThisWeek(),  // the 4-week rotation runs Monday to Sunday
  theme: 'auto'
};

function mondayOfThisWeek(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const EMPTY = {
  profile: { ...DEFAULT_PROFILE },
  weights: [],     // [{date:'YYYY-MM-DD', lb:Number}]
  days: {},        // date -> {habits:{}, meals:{}, drinks:{}, waterMl, sleepHours, restingHr, steps, bpSys, bpDia, waistIn, note}
  workouts: {},    // date -> {session, done, minutes, log:{exerciseName:[{w,r}]}}
  labs: [],        // [{date, totalChol, ldl, hdl, triglycerides, glucose, a1c, vo2max}]
  shop: {},        // 'w1' -> {foodKey:true}
  tests: [],       // [{date, mileMin, pushups, carryM, squatHoldS}]
  meta: { created: null, version: 1 }
};

let state = structuredClone(EMPTY);
const listeners = new Set();

/**
 * @param {object|null} seed  Optional profile from an untracked data/profile.json. Used only on a
 *                            first run; once you have saved data, the saved profile wins.
 */
export function load(seed = null) {
  let hadSaved = false;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      hadSaved = true;
      state = { ...structuredClone(EMPTY), ...parsed };
      state.profile = { ...DEFAULT_PROFILE, ...(parsed.profile || {}) };
    }
  } catch (err) {
    console.warn('Could not read saved data; starting fresh.', err);
  }
  if (!hadSaved && seed) {
    state.profile = { ...DEFAULT_PROFILE, ...seed };
    state.meta.setup = true;
    state.weights = [];
  }
  if (!state.meta.created) state.meta.created = new Date().toISOString();
  if (!state.weights.length) {
    state.weights.push({ date: state.profile.startDate, lb: state.profile.startWeightLb });
  }
  save();
  return state;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Could not save — storage may be full or blocked.', err);
  }
  listeners.forEach((fn) => fn(state));
}

export function get() { return state; }
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/* ---- day log ---- */
export function day(date) {
  if (!state.days[date]) {
    state.days[date] = { habits: {}, meals: {}, drinks: {}, waterMl: 0 };
  }
  const d = state.days[date];
  d.habits ||= {};
  d.meals ||= {};
  d.drinks ||= {};
  return d;
}

export function patchDay(date, patch) {
  Object.assign(day(date), patch);
  save();
}

export function toggle(date, bucket, id) {
  const d = day(date);
  d[bucket][id] = !d[bucket][id];
  save();
  return d[bucket][id];
}

/* ---- weight ---- */
export function logWeight(date, lb) {
  const n = Number(lb);
  if (!Number.isFinite(n) || n <= 0) return;
  const found = state.weights.find((w) => w.date === date);
  if (found) found.lb = n;
  else state.weights.push({ date, lb: n });
  state.weights.sort((a, b) => a.date.localeCompare(b.date));
  save();
}

export function removeWeight(date) {
  state.weights = state.weights.filter((w) => w.date !== date);
  save();
}

/* ---- workouts ---- */
export function workout(date) {
  if (!state.workouts[date]) state.workouts[date] = { done: false, log: {}, minutes: 0 };
  state.workouts[date].log ||= {};
  return state.workouts[date];
}

export function patchWorkout(date, patch) {
  Object.assign(workout(date), patch);
  save();
}

export function logSet(date, exercise, index, entry) {
  const w = workout(date);
  w.log[exercise] ||= [];
  w.log[exercise][index] = { ...(w.log[exercise][index] || {}), ...entry };
  save();
}

/* ---- labs & tests ---- */
export function addLab(entry) {
  state.labs.push(entry);
  state.labs.sort((a, b) => a.date.localeCompare(b.date));
  save();
}
export function addTest(entry) {
  state.tests.push(entry);
  state.tests.sort((a, b) => a.date.localeCompare(b.date));
  save();
}

/* ---- first-run setup ---- */
export function needsSetup() { return !state.meta.setup; }

export function completeSetup(profile) {
  Object.assign(state.profile, profile);
  state.meta.setup = true;
  state.weights = [{ date: profile.startDate, lb: Number(profile.startWeightLb) }];
  save();
}

/* ---- profile ---- */
export function patchProfile(patch) {
  Object.assign(state.profile, patch);
  save();
}

/* ---- shopping list ---- */
export function shopWeek(key) {
  state.shop[key] ||= {};
  return state.shop[key];
}
export function toggleShop(key, food) {
  const w = shopWeek(key);
  w[food] = !w[food];
  save();
  return w[food];
}
export function clearShop(key) {
  state.shop[key] = {};
  save();
}

/* ---- backup ---- */
export function exportJson() {
  return JSON.stringify(state, null, 2);
}

export function importJson(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a Healthy Living backup file.');
  state = { ...structuredClone(EMPTY), ...parsed };
  state.profile = { ...DEFAULT_PROFILE, ...(parsed.profile || {}) };
  save();
}

export function resetAll() {
  state = structuredClone(EMPTY);
  state.meta.created = new Date().toISOString();
  state.weights.push({ date: state.profile.startDate, lb: state.profile.startWeightLb });
  save();
}
