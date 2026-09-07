/* Views: Today, Plan, Shop */

import * as S from './store.js';
import * as C from './calc.js';
import * as N from './nutrition.js';
import { esc, num, metric, bar, pill, sourceLine, progressRow, on } from './ui.js';

/* ============================== TODAY ============================== */

export function renderToday(ctx) {
  const { data, today, t, pos, profile } = ctx;
  const week = data.plan.weeks[pos.weekIdx];
  const dayPlan = week.days.find((d) => d.day === pos.dayName) || week.days[0];
  const log = S.day(today);
  const planned = N.dayTotals(dayPlan, data);
  const eaten = N.loggedTotals(dayPlan, data, log);
  const waterMl = N.drinkMlLogged(data.plan, log) + (log.waterMl || 0);
  const caffeine = N.caffeineLogged(data.plan, data.foods, log);
  const fast = C.fastState(profile, new Date());
  const latest = ctx.latestWeight;
  const bmiNow = C.bmi(latest.lb, profile.heightIn);
  const cat = C.bmiCategory(bmiNow);
  const progWeek = C.programWeek(profile, today);
  const session = data.program.weeklyTemplate.find((d) => d.day === pos.dayName);

  const slots = [
    { slot: 'lunch', time: profile.eatFrom, label: 'First meal' },
    { slot: 'snack', time: '15:30', label: 'Afternoon' },
    { slot: 'dinner', time: '18:45', label: 'Dinner' }
  ];

  return `
  <section class="card">
    <div class="card-head">
      <div><span class="eyebrow">Week ${pos.weekNumber} of the rotation · ${esc(pos.dayName)}</span>
        <h2>${esc(C.fmtDate(today))}</h2></div>
      ${pill(cat.label, cat.tone)}
    </div>
    <div class="metrics">
      ${metric('Weight', num(latest.lb, 1), 'lb')}
      ${metric('BMI', num(bmiNow, 1), '', `<div class="tiny dim">healthy 18.5–24.9</div>`)}
      ${metric('Calorie target', num(t.kcal), 'kcal', `<div class="tiny dim">TDEE ${num(t.tdee)}</div>`)}
      ${metric('Protein', `${t.proteinG[0]}–${t.proteinG[1]}`, 'g')}
      ${metric('To healthy BMI', num(t.toHealthyLb, 1), 'lb')}
      ${metric('Fasting', fast.eating ? 'Open' : 'Closed', '', `<div class="tiny dim">${esc(fast.detail)}</div>`)}
    </div>
    <hr class="hr">
    <div class="stack">
      ${progressRow('Calories eaten', Math.round(eaten.nutrients.kcal), t.kcal, ' kcal')}
      ${progressRow('Protein', Math.round(eaten.nutrients.protein_g), t.proteinG[0], ' g')}
      ${progressRow('Fibre', Math.round(eaten.nutrients.fiber_g), C.GUIDE.fiberG, ' g')}
      ${progressRow('Fluid', Math.round(waterMl), C.GUIDE.waterDrinksMl, ' ml')}
    </div>
    <p class="tiny dim" style="margin-top:.5rem">Today's menu as planned: ${num(planned.nutrients.kcal)} kcal,
      ${num(planned.nutrients.protein_g)} g protein, ${num(planned.nutrients.fiber_g)} g fibre,
      ${num(planned.nutrients.sodium_mg)} mg sodium, ${num(planned.nutrients.satfat_g)} g saturated fat.
      The menus are written to the Dietary Guidelines' ${num(data.plan.calorieLevel)}-calorie pattern;
      your own target is ${num(t.kcal)}.</p>
    ${trimBlock(ctx, planned.nutrients.kcal - t.kcal)}
  </section>

  <section class="card">
    <div class="card-head"><h3>${fast.eating ? 'Eating window is open' : 'You are fasting'}</h3>
      <span class="pill ${fast.eating ? 'ok' : ''}">${esc(C.minToLabel(C.hhmmToMin(profile.eatFrom)))}–${esc(C.minToLabel(C.hhmmToMin(profile.eatTo)))}</span></div>
    <p class="muted" style="margin:0">${esc(fast.detail)}.</p>
    <details class="disclose"><summary>What is allowed while fasting</summary><div>
      <ul>${data.plan.fasting.allowedWhileFasting.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p><b>Stop and reassess if:</b></p>
      <ul>${data.plan.fasting.stopIf.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="note warn">${esc(data.plan.fasting.medicalNote)}</p>
      ${sourceLine(data.sources, data.plan.fasting.sources)}
    </div></details>
  </section>

  <section class="card">
    <div class="card-head"><h3>Today's food</h3><span class="eyebrow">${esc(week.theme)}</span></div>
    <ul class="list">
      ${slots.map(({ slot, time, label }) => mealRow(ctx, dayPlan[slot], slot, time, label, log)).join('')}
      <li>
        <label class="check ${log.meals?.extras ? 'done' : ''}">
          <input type="checkbox" data-meal="extras" ${log.meals?.extras ? 'checked' : ''}>
          <span class="check-label"><b>Daily extras</b> — ${data.plan.dailyExtras.items
            .map((i) => esc(`${i.measure} ${data.foods[i.food].name.toLowerCase()}`)).join(', ')}</span>
        </label>
      </li>
    </ul>
  </section>

  <section class="card">
    <div class="card-head"><h3>Drinks</h3>
      <span class="pill ${caffeine > C.GUIDE.caffeineMaxMg ? 'bad' : 'ok'}">${num(caffeine)} mg caffeine</span></div>
    <p class="tiny dim" style="margin-bottom:.4rem">${esc(data.plan.drinks.note)}</p>
    <ul class="list">
      ${data.plan.drinks.schedule.map((d, i) => `
        <li>
          <label class="check ${log.drinks?.[i] ? 'done' : ''}" style="border:0;padding:0">
            <input type="checkbox" data-drink="${i}" ${log.drinks?.[i] ? 'checked' : ''}>
            <span class="check-label"><b>${esc(d.time)}</b> ${esc(d.label)}
              ${d.fastSafe ? pill('fast-safe', 'ok') : ''}
              <span class="item-sub" style="display:block">${esc(d.why)}</span></span>
          </label>
        </li>`).join('')}
    </ul>
    <div class="row" style="margin-top:.5rem">
      <button class="btn small" data-water="250">+250 ml extra</button>
      <button class="btn small" data-water="500">+500 ml extra</button>
      <span class="tiny dim">${num(waterMl)} / ${num(C.GUIDE.waterDrinksMl)} ml</span>
    </div>
    <details class="disclose"><summary>What to avoid</summary><div>
      <ul>${data.plan.drinks.avoid.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      ${sourceLine(data.sources, ['dga2025', 'fdaCaffeine', 'nccihGreenTea', 'cdcSleep'])}
    </div></details>
  </section>

  <section class="card">
    <div class="card-head"><h3>Training — week ${progWeek}</h3>
      <span class="pill">${esc(session ? session.type : 'rest')}</span></div>
    ${session ? `<p style="margin:0"><b>${esc(sessionName(data.program, session.session))}</b> ·
      ${session.minutes} min${session.extra ? ` + ${esc(sessionName(data.program, session.extra))}` : ''}</p>` : ''}
    <div class="row" style="margin-top:.6rem">
      <label class="check" style="border:0;padding:0">
        <input type="checkbox" data-workout-done ${S.workout(today).done ? 'checked' : ''}>
        <span class="check-label">Done</span>
      </label>
      <button class="btn small" data-goto="train">Open the session</button>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><h3>Daily habits</h3>
      <span class="pill">${Object.values(log.habits || {}).filter(Boolean).length} / ${data.lifestyle.habits.length}</span></div>
    ${data.lifestyle.habits.map((h) => `
      <label class="check ${log.habits?.[h.id] ? 'done' : ''}">
        <input type="checkbox" data-habit="${esc(h.id)}" ${log.habits?.[h.id] ? 'checked' : ''}>
        <span class="check-label">${esc(h.label)} <span class="dim tiny">· ${esc(h.group)}</span></span>
      </label>`).join('')}
  </section>

  <section class="card">
    <h3>Log today</h3>
    <div class="grid2">
      <label class="field"><span>Weight (lb)</span>
        <input type="number" step="0.1" inputmode="decimal" data-log="weight"
          value="${log.weighed ? esc(log.weighed) : ''}" placeholder="${num(latest.lb, 1)}"></label>
      <label class="field"><span>Sleep (hours)</span>
        <input type="number" step="0.25" inputmode="decimal" data-log="sleepHours" value="${esc(log.sleepHours ?? '')}"></label>
      <label class="field"><span>Resting HR (bpm)</span>
        <input type="number" inputmode="numeric" data-log="restingHr" value="${esc(log.restingHr ?? '')}"></label>
      <label class="field"><span>Steps</span>
        <input type="number" inputmode="numeric" data-log="steps" value="${esc(log.steps ?? '')}"></label>
      <label class="field"><span>BP systolic</span>
        <input type="number" inputmode="numeric" data-log="bpSys" value="${esc(log.bpSys ?? '')}"></label>
      <label class="field"><span>BP diastolic</span>
        <input type="number" inputmode="numeric" data-log="bpDia" value="${esc(log.bpDia ?? '')}"></label>
      <label class="field"><span>Waist (in)</span>
        <input type="number" step="0.1" inputmode="decimal" data-log="waistIn" value="${esc(log.waistIn ?? '')}"></label>
    </div>
    <label class="field"><span>Note to yourself</span>
      <textarea rows="2" data-log="note">${esc(log.note ?? '')}</textarea></label>
    <p class="tiny dim">Saved on this device as you type. Nothing is uploaded anywhere.</p>
  </section>`;
}

function sessionName(program, key) {
  return program.sessions[key]?.name || key;
}

/** Concrete ways to close a gap between the printed menu and the personal calorie target. */
function trimBlock(ctx, gap) {
  const { data } = ctx;
  if (gap <= 40) {
    return `<p class="note" style="margin-top:.5rem">Today's menu is inside your target as written —
      no trimming needed.</p>`;
  }
  let left = gap;
  const rows = data.plan.trims.items.map((it) => {
    const kcal = Math.round((data.foods[it.food].per100g.kcal || 0) * it.g / 100);
    const take = left > 0;
    if (take) left -= kcal;
    return `<li>${take ? '<b>' : ''}${esc(it.label)} — ${kcal} kcal${take ? '</b>' : ''}</li>`;
  }).join('');
  return `<details class="disclose" open><summary>Trim about ${num(gap)} kcal from today</summary><div>
    <p class="tiny dim">${esc(data.plan.trims.note)}</p>
    <ul>${rows}</ul>
    <p class="tiny dim">The bolded ones add up to roughly the gap. Everything here comes off fat or
      refined-carbohydrate calories, so the protein and fibre targets survive the cut.</p>
  </div></details>`;
}

function mealRow(ctx, mealId, slot, time, label, log) {
  const { data, sources } = ctx;
  const meal = data.meals.meals[mealId];
  if (!meal) return '';
  const t = N.mealTotals(meal, data.foods);
  const done = !!log.meals?.[slot];
  return `<li>
    <label class="check ${done ? 'done' : ''}" style="border:0;padding:0">
      <input type="checkbox" data-meal="${slot}" ${done ? 'checked' : ''}>
      <span class="check-label">
        <span class="eyebrow">${esc(label)} · ${esc(time)} · ${esc(meal.minutes)} min</span>
        <b style="display:block">${esc(meal.name)}</b>
        <span class="item-sub">${num(t.nutrients.kcal)} kcal · ${num(t.nutrients.protein_g)} g protein ·
          ${num(t.nutrients.fiber_g)} g fibre</span>
      </span>
    </label>
    <details class="disclose" style="border:0"><summary>Ingredients and method</summary><div>
      <table><thead><tr><th>Food</th><th>Amount</th><th>kcal</th><th>Protein</th></tr></thead><tbody>
      ${meal.items.map((it) => {
        const f = data.foods[it.food];
        const k = (f.per100g.kcal || 0) * it.g / 100;
        const p = (f.per100g.protein_g || 0) * it.g / 100;
        return `<tr><td>${esc(f.name)}</td><td>${esc(it.measure)} (${num(it.g)} g)</td>
          <td>${num(k)}</td><td>${num(p, 1)}</td></tr>`;
      }).join('')}
      </tbody></table>
      <p style="margin-top:.6rem"><b>Method.</b> ${esc(meal.how)}</p>
      ${meal.batch ? `<p class="note">${esc(meal.batch)}</p>` : ''}
      <p class="src">Nutrition computed from USDA FoodData Central entries — every food in this app
        carries its FDC ID, listed under Sources.</p>
    </div></details>
  </li>`;
}

export function bindToday(root, ctx) {
  const { today } = ctx;
  on(root, '[data-meal]', 'change', (e) => {
    S.toggle(today, 'meals', e.target.dataset.meal);
    ctx.refresh();
  });
  on(root, '[data-drink]', 'change', (e) => {
    S.toggle(today, 'drinks', e.target.dataset.drink);
    ctx.refresh();
  });
  on(root, '[data-habit]', 'change', (e) => {
    S.toggle(today, 'habits', e.target.dataset.habit);
    ctx.refresh();
  });
  on(root, '[data-water]', 'click', (e) => {
    const log = S.day(today);
    S.patchDay(today, { waterMl: (log.waterMl || 0) + Number(e.target.dataset.water) });
    ctx.refresh();
  });
  on(root, '[data-workout-done]', 'change', (e) => {
    S.patchWorkout(today, { done: e.target.checked });
    ctx.refresh();
  });
  on(root, '[data-goto]', 'click', (e) => ctx.go(e.target.dataset.goto));
  on(root, '[data-log]', 'change', (e) => {
    const field = e.target.dataset.log;
    const raw = e.target.value;
    if (field === 'weight') {
      if (raw !== '') {
        S.logWeight(today, raw);
        S.patchDay(today, { weighed: raw, habits: { ...S.day(today).habits, weigh: true } });
      }
    } else if (field === 'note') {
      S.patchDay(today, { note: raw });
    } else {
      S.patchDay(today, { [field]: raw === '' ? undefined : Number(raw) });
    }
    ctx.refresh({ keepScroll: true });
  });
}

/* ============================== PLAN ============================== */

export function renderPlan(ctx) {
  const { data, pos } = ctx;
  const shown = ctx.ui.planWeek ?? pos.weekIdx;
  const week = data.plan.weeks[shown];
  const dayCards = week.days.map((d) => {
    const totals = N.dayTotals(d, data);
    const status = N.servingStatus(totals.servings, data.plan.pattern);
    return `<div class="card">
      <div class="card-head"><h3>${esc(d.day)}</h3>
        <span class="tiny dim">${num(totals.nutrients.kcal)} kcal · ${num(totals.nutrients.protein_g)} g protein ·
          ${num(totals.nutrients.fiber_g)} g fibre</span></div>
      <ul class="list">
        ${['lunch', 'snack', 'dinner'].map((slot) => {
          const meal = data.meals.meals[d[slot]];
          const mt = N.mealTotals(meal, data.foods);
          return `<li><div class="spread">
            <div><span class="eyebrow">${slot === 'lunch' ? 'First meal · 12:00'
              : slot === 'snack' ? 'Snack · 15:30' : 'Dinner · 18:45'}</span>
              <div class="item-title">${esc(meal.name)}</div>
              <div class="item-sub">${esc(meal.style.replace('-', ' '))} · ${meal.minutes} min ·
                ${num(mt.nutrients.kcal)} kcal · ${num(mt.nutrients.protein_g)} g protein</div></div>
          </div>
          <details class="disclose" style="border:0"><summary>What's in it</summary><div>
            <ul>${meal.items.map((it) => `<li>${esc(it.measure)} — ${esc(data.foods[it.food].name)}
              <span class="dim">(${num(it.g)} g)</span></li>`).join('')}</ul>
            <p>${esc(meal.how)}</p></div></details></li>`;
        }).join('')}
      </ul>
      <div class="row" style="margin-top:.4rem">
        ${status.map((s) => pill(`${s.label} ${s.value.toFixed(1)}/${s.hi}`, s.tone === 'ok' ? 'ok' : 'warn')).join(' ')}
      </div>
    </div>`;
  }).join('');

  return `
  <section class="card">
    <div class="card-head"><div><span class="eyebrow">4-week rotating menu</span>
      <h2>Week ${shown + 1}</h2></div>
      <span class="pill ok">${num(data.plan.calorieLevel)} kcal pattern</span></div>
    <div class="seg" role="group" aria-label="Choose week">
      ${data.plan.weeks.map((w, i) => `<button data-week="${i}" aria-pressed="${i === shown}">Week ${w.week}</button>`).join('')}
    </div>
    <p class="muted" style="margin-top:.6rem">${esc(week.theme)}</p>
    <p class="tiny dim">You are on week ${pos.weekNumber} today. The rotation repeats every 28 days,
      so a bulk shop covers a whole week and the same shop comes round again a month later.</p>
    ${sourceLine(data.sources, ['dga2025', 'dgaServings', 'fdc'], 'Built from')}
  </section>

  <section class="card">
    <h3>What the pattern asks for each day</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>Food group</th><th>Target</th><th>This week's average</th></tr></thead>
      <tbody>
      ${Object.entries(data.plan.pattern.targets).map(([g, [lo, hi]]) => {
        const avg = week.days.reduce((s, d) => s + N.dayTotals(d, data).servings[g], 0) / week.days.length;
        return `<tr><td>${esc(N.GROUP_LABEL[g])}</td>
          <td>${lo === hi ? lo : `${lo}–${hi}`}${g === 'fat' ? ' tsp' : ''}</td>
          <td>${avg.toFixed(1)}</td></tr>`;
      }).join('')}
      </tbody></table></div>
    <p class="tiny dim">Beans, peas and lentils count toward either the protein group or the vegetable
      group in the Dietary Guidelines — this app counts them as protein, which is why the protein
      serving count runs above the pattern's 3–4 while protein grams stay inside the 1.2–1.6 g/kg goal.</p>
  </section>

  <section class="card">
    <h3>Fasting protocol</h3>
    <div class="metrics">
      ${metric('Protocol', esc(data.plan.fasting.protocol.split(' ')[0]))}
      ${metric('Eat between', `${esc(data.plan.fasting.eatFrom)}–${esc(data.plan.fasting.eatTo)}`)}
      ${metric('Fast', data.plan.fasting.fastHours, 'h')}
    </div>
    <p class="note warn" style="margin-top:.6rem">${esc(data.plan.fasting.medicalNote)}</p>
    ${sourceLine(data.sources, data.plan.fasting.sources)}
  </section>

  ${dayCards}

  <section class="card">
    <h3>Shopping principles</h3>
    <ul>${data.plan.shoppingNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
  </section>`;
}

export function bindPlan(root, ctx) {
  on(root, '[data-week]', 'click', (e) => {
    ctx.ui.planWeek = Number(e.target.dataset.week);
    ctx.refresh();
  });
}

/* ============================== SHOP ============================== */

export function renderShop(ctx) {
  const { data, pos } = ctx;
  const shown = ctx.ui.shopWeek ?? pos.weekIdx;
  const week = data.plan.weeks[shown];
  const list = N.weekShoppingList(week, data);
  const key = `w${shown + 1}`;
  const checked = S.shopWeek(key);
  const totalItems = list.reduce((s, a) => s + a.items.length, 0);
  const doneItems = list.reduce((s, a) => s + a.items.filter((i) => checked[i.key]).length, 0);

  return `
  <section class="card">
    <div class="card-head"><div><span class="eyebrow">One bulk shop, seven days</span>
      <h2>Week ${shown + 1} shopping list</h2></div>
      <span class="pill ${doneItems === totalItems ? 'ok' : ''}">${doneItems}/${totalItems}</span></div>
    <div class="seg" role="group" aria-label="Choose week">
      ${data.plan.weeks.map((w, i) => `<button data-shopweek="${i}" aria-pressed="${i === shown}">Week ${w.week}</button>`).join('')}
    </div>
    <p class="tiny dim" style="margin-top:.6rem">Quantities are the exact totals the week's menus call for,
      summed from the gram amounts in every meal, plus the daily milk, kefir and tea. Round up when you buy —
      a little spare is better than a missing dinner.</p>
    <button class="btn small ghost" data-clearshop="${key}">Clear ticks</button>
  </section>

  ${list.map((aisle) => `
    <section class="card">
      <h3>${esc(aisle.aisle)}</h3>
      ${aisle.items.map((i) => `
        <label class="check ${checked[i.key] ? 'done' : ''}">
          <input type="checkbox" data-shop="${esc(i.key)}" data-key="${esc(key)}" ${checked[i.key] ? 'checked' : ''}>
          <span class="check-label"><b>${esc(i.food.name)}</b>
            <span class="item-sub" style="display:block">${esc(i.buy)} · ${num(i.grams)} g total for the week</span>
          </span>
        </label>`).join('')}
    </section>`).join('')}

  <section class="card">
    <h3>Batch-cooking order for the weekend</h3>
    <ol>
      <li>Start the dried beans or peas soaking first thing — they need the longest.</li>
      <li>Oven on: sweet potato, plantain and any roasting vegetables together on two trays.</li>
      <li>Grains next, in one big pot each: brown rice, millet, quinoa, bulgur or barley as the week needs.</li>
      <li>Boil a dozen eggs while the grains cook.</li>
      <li>Build the tomato base — paste, onion, pepper, chilli — and keep it in a jar; three of the week's dishes start from it.</li>
      <li>Grill or roast the week's chicken and portion it cold into containers.</li>
      <li>Wash and cut raw vegetables last so they stay crisp.</li>
    </ol>
    <p class="tiny dim">Fish, shrimp and greens are best cooked the day you eat them. Everything else
      keeps 3–4 days in the fridge, or freeze half on the Sunday.</p>
  </section>`;
}

export function bindShop(root, ctx) {
  on(root, '[data-shopweek]', 'click', (e) => {
    ctx.ui.shopWeek = Number(e.target.dataset.shopweek);
    ctx.refresh();
  });
  on(root, '[data-shop]', 'change', (e) => {
    S.toggleShop(e.target.dataset.key, e.target.dataset.shop);
    ctx.refresh({ keepScroll: true });
  });
  on(root, '[data-clearshop]', 'click', (e) => {
    S.clearShop(e.target.dataset.clearshop);
    ctx.refresh();
  });
}
