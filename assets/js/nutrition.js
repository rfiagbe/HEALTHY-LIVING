/* Turns grams of USDA-referenced foods into meal, day and week totals.
   The same arithmetic as tools/validate_plan.py, so the app and the audit script agree. */

export const NUTRIENT_KEYS = [
  'kcal', 'protein_g', 'fat_g', 'satfat_g', 'carb_g', 'fiber_g', 'sugar_g',
  'sodium_mg', 'potassium_mg', 'calcium_mg', 'iron_mg', 'magnesium_mg',
  'cholesterol_mg', 'vitc_mg', 'caffeine_mg'
];

const COUNTED_GROUPS = ['protein', 'dairy', 'vegetable', 'fruit', 'grain', 'fat'];

export const GROUP_LABEL = {
  protein: 'Protein foods',
  dairy: 'Dairy',
  vegetable: 'Vegetables',
  fruit: 'Fruit',
  grain: 'Whole grains',
  fat: 'Healthy fats'
};

/* Shopping aisles, derived from the food group plus a short plant-protein list. */
const PLANT_PROTEIN = new Set([
  'black_beans', 'chickpeas', 'lentils', 'black_eyed_peas', 'kidney_beans', 'white_beans',
  'edamame', 'tofu_firm', 'peanut_butter', 'peanuts', 'almonds', 'walnuts', 'cashews',
  'pumpkin_seeds', 'chia', 'flaxseed', 'sesame'
]);

export function aisleOf(key, food) {
  if (food.group === 'protein') return PLANT_PROTEIN.has(key) ? 'Beans, nuts & seeds' : 'Meat, fish & eggs';
  if (food.group === 'dairy') return 'Dairy';
  if (food.group === 'vegetable') return 'Vegetables & starchy roots';
  if (food.group === 'fruit') return 'Fruit';
  if (food.group === 'grain') return 'Grains & bread';
  if (food.group === 'fat') return 'Oils & fats';
  if (food.group === 'drink') return 'Tea, coffee & water';
  return 'Store cupboard';
}

export function emptyTotals() {
  const nutrients = {};
  NUTRIENT_KEYS.forEach((k) => { nutrients[k] = 0; });
  const servings = {};
  COUNTED_GROUPS.forEach((g) => { servings[g] = 0; });
  return { nutrients, servings };
}

export function addFood(totals, foods, key, grams) {
  const food = foods[key];
  if (!food) { console.warn('Unknown food key', key); return totals; }
  const per = food.per100g || {};
  NUTRIENT_KEYS.forEach((k) => {
    totals.nutrients[k] += (per[k] || 0) * grams / 100;
  });
  if (COUNTED_GROUPS.includes(food.group) && food.dgaServingGrams) {
    totals.servings[food.group] += grams / food.dgaServingGrams;
  }
  return totals;
}

export function mergeTotals(into, other) {
  NUTRIENT_KEYS.forEach((k) => { into.nutrients[k] += other.nutrients[k]; });
  COUNTED_GROUPS.forEach((g) => { into.servings[g] += other.servings[g]; });
  return into;
}

export function mealTotals(meal, foods) {
  const t = emptyTotals();
  meal.items.forEach((it) => addFood(t, foods, it.food, it.g));
  return t;
}

/** Totals for one planned day: the three meals, the daily extras and the drink schedule. */
export function dayTotals(dayPlan, data) {
  const { foods, meals, plan } = data;
  const t = emptyTotals();
  ['lunch', 'snack', 'dinner'].forEach((slot) => {
    const meal = meals.meals[dayPlan[slot]];
    if (meal) mergeTotals(t, mealTotals(meal, foods));
  });
  plan.dailyExtras.items.forEach((it) => addFood(t, foods, it.food, it.g));
  plan.drinks.schedule.forEach((d) => {
    if (foods[d.item]) addFood(t, foods, d.item, d.ml); // 1 ml of water, tea or coffee ≈ 1 g
  });
  return t;
}

/** Everything you actually consumed today, based on what has been ticked off. */
export function loggedTotals(dayPlan, data, log) {
  const { foods, meals, plan } = data;
  const t = emptyTotals();
  ['lunch', 'snack', 'dinner'].forEach((slot) => {
    if (!log.meals?.[slot]) return;
    const meal = meals.meals[dayPlan[slot]];
    if (meal) mergeTotals(t, mealTotals(meal, foods));
  });
  if (log.meals?.extras) plan.dailyExtras.items.forEach((it) => addFood(t, foods, it.food, it.g));
  plan.drinks.schedule.forEach((d, i) => {
    if (log.drinks?.[i] && foods[d.item]) addFood(t, foods, d.item, d.ml);
  });
  return t;
}

export function drinkMlLogged(plan, log) {
  return plan.drinks.schedule.reduce((sum, d, i) => sum + (log.drinks?.[i] ? d.ml : 0), 0);
}

export function caffeineLogged(plan, foods, log) {
  return plan.drinks.schedule.reduce((sum, d, i) => {
    if (!log.drinks?.[i]) return sum;
    const per = foods[d.item]?.per100g?.caffeine_mg || 0;
    return sum + per * d.ml / 100;
  }, 0);
}

/** Aggregate one plan week into a shopping list: grams per food, grouped by aisle. */
export function weekShoppingList(weekPlan, data) {
  const { foods, meals, plan } = data;
  const grams = new Map();
  const bump = (key, g) => grams.set(key, (grams.get(key) || 0) + g);

  weekPlan.days.forEach((d) => {
    ['lunch', 'snack', 'dinner'].forEach((slot) => {
      const meal = meals.meals[d[slot]];
      if (meal) meal.items.forEach((it) => bump(it.food, it.g));
    });
    plan.dailyExtras.items.forEach((it) => bump(it.food, it.g));
    plan.drinks.schedule.forEach((dr) => {
      if (dr.item !== 'water' && foods[dr.item]) bump(dr.item, dr.ml);
    });
  });

  const aisles = new Map();
  [...grams.entries()].forEach(([key, g]) => {
    const food = foods[key];
    if (!food) return;
    const aisle = aisleOf(key, food);
    if (!aisles.has(aisle)) aisles.set(aisle, []);
    aisles.get(aisle).push({ key, food, grams: g, buy: buyQuantity(food, g) });
  });
  [...aisles.values()].forEach((list) => list.sort((a, b) => b.grams - a.grams));

  const order = ['Meat, fish & eggs', 'Beans, nuts & seeds', 'Dairy', 'Vegetables & starchy roots',
    'Fruit', 'Grains & bread', 'Oils & fats', 'Tea, coffee & water', 'Store cupboard'];
  return order.filter((a) => aisles.has(a)).map((a) => ({ aisle: a, items: aisles.get(a) }));
}

/** A human shopping quantity: pounds for anything heavy, cups where USDA gives a cup weight. */
export function buyQuantity(food, grams) {
  const parts = [];
  if (food.group === 'drink') {
    parts.push(`${Math.round(grams / 240)} cups brewed`);
  } else if (grams >= 454) {
    parts.push(`${(grams / 453.592).toFixed(1)} lb`);
  } else if (grams >= 60) {
    parts.push(`${Math.round(grams / 28.35)} oz`);
  } else {
    parts.push(`${Math.round(grams)} g`);
  }
  if (food.cupGrams && food.group !== 'drink' && grams / food.cupGrams >= 0.5) {
    parts.push(`~${(grams / food.cupGrams).toFixed(1)} cups`);
  }
  return parts.join(' · ');
}

/** How a day's servings compare with the pattern targets in the Dietary Guidelines. */
export function servingStatus(servings, pattern) {
  return COUNTED_GROUPS.map((g) => {
    const [lo, hi] = pattern.targets[g] || [0, 0];
    const v = servings[g] || 0;
    let tone = 'ok';
    if (v < lo - 0.25) tone = 'warn';
    if (g !== 'protein' && v > hi + 1.25) tone = 'warn';
    return { group: g, label: GROUP_LABEL[g], value: v, lo, hi, tone };
  });
}
