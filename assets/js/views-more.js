/* Views: Train, Track, Longevity, Sources & settings */

import * as S from './store.js';
import * as C from './calc.js';
import * as N from './nutrition.js';
import { esc, num, metric, pill, sourceLine, lineChart, progressRow, on } from './ui.js';

/* ---------- shared helpers ---------- */

function lastDays(ctx, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const date = C.addDays(ctx.today, -i);
    out.push({ date, log: ctx.state.days[date] || {}, workout: ctx.state.workouts[date] || {} });
  }
  return out;
}

function avgOf(rows, pick) {
  const vals = rows.map(pick).filter((v) => Number.isFinite(v) && v > 0);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function latestLab(ctx) {
  return ctx.state.labs.length ? ctx.state.labs[ctx.state.labs.length - 1] : null;
}

function latestBp(ctx) {
  const rows = lastDays(ctx, 60).find((r) => Number(r.log.bpSys) > 0 && Number(r.log.bpDia) > 0);
  return rows ? { sys: Number(rows.log.bpSys), dia: Number(rows.log.bpDia), date: rows.date } : null;
}

/* ============================== TRAIN ============================== */

export function renderTrain(ctx) {
  const { data, profile, today, pos } = ctx;
  const week = C.programWeek(profile, today);
  const phase = C.phaseFor(data.program, week);
  const template = data.program.weeklyTemplate;
  const todaySlot = template.find((d) => d.day === pos.dayName);
  const shownKey = ctx.ui.session || todaySlot?.session || 'A';
  const session = data.program.sessions[shownKey];
  const w = S.workout(today);

  const rows = lastDays(ctx, 7);
  const aerobicMin = rows.reduce((s, r) => s + (Number(r.workout.minutes) || 0), 0);
  const strengthDays = rows.filter((r) => r.workout.done && ['A', 'B', 'C'].includes(r.workout.session)).length;

  return `
  <section class="card">
    <div class="card-head"><div><span class="eyebrow">${esc(data.program.name)}</span>
      <h2>Week ${week} · phase ${esc(phase.weeks)}</h2></div>
      <span class="pill ok">${phase.strengthDays} strength · ${phase.aerobicMinutes} aerobic min</span></div>
    <p class="muted" style="margin:0">${esc(phase.focus)}</p>
    <hr class="hr">
    <div class="stack">
      ${progressRow('Aerobic minutes, last 7 days', Math.round(aerobicMin), phase.aerobicMinutes, ' min')}
      ${progressRow('Strength sessions, last 7 days', strengthDays, C.GUIDE.strengthDays)}
    </div>
    <p class="tiny dim">The guideline range is ${C.GUIDE.aerobicMinutes[0]}–${C.GUIDE.aerobicMinutes[1]} minutes
      of moderate aerobic activity a week plus muscle-strengthening on ${C.GUIDE.strengthDays}+ days.
      This programme starts at the bottom of that range and finishes at the top.</p>
    ${sourceLine(data.sources, data.program.builtOn.sources, 'Built from')}
  </section>

  <section class="card">
    <h3>This week</h3>
    <ul class="list">
      ${template.map((d) => `<li class="spread">
        <div><b>${esc(d.day)}</b>
          <div class="item-sub">${esc(data.program.sessions[d.session]?.name || d.session)}${d.extra ? ` + ${esc(data.program.sessions[d.extra].name)}` : ''}</div>
          ${d.note ? `<div class="item-sub dim">${esc(d.note)}</div>` : ''}</div>
        <div class="tiny dim">${d.minutes} min</div>
      </li>`).join('')}
    </ul>
  </section>

  <section class="card">
    <div class="card-head"><h3>${esc(session.name)}</h3>
      <span class="pill">${esc(shownKey)}</span></div>
    <div class="seg" role="group" aria-label="Choose session">
      ${Object.keys(data.program.sessions).map((k) => `<button data-session="${esc(k)}"
        aria-pressed="${k === shownKey}">${esc(k)}</button>`).join('')}
    </div>
    ${session.warmup ? `<p class="note" style="margin-top:.6rem"><b>Warm-up.</b> ${esc(session.warmup)}</p>` : ''}
    ${session.howLong ? `<p style="margin-top:.6rem"><b>How long.</b> ${esc(session.howLong)}</p>` : ''}
    ${session.how ? `<p><b>How.</b> ${esc(session.how)}</p>` : ''}
    ${session.why ? `<p class="muted">${esc(session.why)}</p>` : ''}
    ${session.caution ? `<p class="note warn">${esc(session.caution)}</p>` : ''}
    ${session.blocks ? `<ul>${session.blocks.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    ${session.exercises ? session.exercises.map((ex) => exerciseBlock(ex, phase, w, today)).join('') : ''}
    ${session.exercises ? `
      <div class="row" style="margin-top:.6rem">
        <label class="check" style="border:0;padding:0">
          <input type="checkbox" data-done ${w.done ? 'checked' : ''}>
          <span class="check-label">Mark session complete</span></label>
        <label class="field" style="margin:0;flex:1;min-width:8rem"><span>Minutes</span>
          <input type="number" inputmode="numeric" data-minutes value="${esc(w.minutes || '')}"></label>
      </div>` : `
      <div class="row" style="margin-top:.6rem">
        <label class="field" style="margin:0;flex:1;min-width:8rem"><span>Minutes done today</span>
          <input type="number" inputmode="numeric" data-minutes value="${esc(w.minutes || '')}"></label>
        <label class="check" style="border:0;padding:0">
          <input type="checkbox" data-done ${w.done ? 'checked' : ''}>
          <span class="check-label">Done</span></label>
      </div>`}
    <p class="tiny dim" style="margin-top:.5rem">${esc(data.program.intensity.strengthEffort)}</p>
  </section>

  <section class="card">
    <h3>Intensity, without a heart-rate strap</h3>
    <p class="tiny dim">${esc(data.program.intensity.note)}</p>
    <div class="kv"><span class="kv-k">Moderate</span><span class="kv-v" style="font-weight:400;text-align:right">${esc(data.program.intensity.moderate)}</span></div>
    <div class="kv"><span class="kv-k">Vigorous</span><span class="kv-v" style="font-weight:400;text-align:right">${esc(data.program.intensity.vigorous)}</span></div>
  </section>

  <section class="card">
    <h3>Progression rules</h3>
    <ul>${data.program.progression.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </section>

  <section class="card">
    <h3>Training around the fasting window</h3>
    <p class="tiny dim">${esc(data.program.fastedTraining.note)}</p>
    <ul>${data.program.fastedTraining.options.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
  </section>

  <section class="card">
    <h3>Fitness tests every 4 weeks</h3>
    <p class="tiny dim">${esc(data.program.fitnessTests.note)}</p>
    <ul class="list">
      ${data.program.fitnessTests.tests.map((t) => `<li>
        <div class="item-title">${esc(t.name)}</div>
        <div class="item-sub">${esc(t.how)}</div>
        <div class="item-sub dim">${esc(t.why)}</div></li>`).join('')}
    </ul>
    <div class="grid2" style="margin-top:.6rem">
      <label class="field"><span>1-mile time (min)</span><input type="number" step="0.1" data-test="mileMin"></label>
      <label class="field"><span>Push-ups</span><input type="number" data-test="pushups"></label>
      <label class="field"><span>Farmer carry (m)</span><input type="number" data-test="carryM"></label>
      <label class="field"><span>Squat hold (s)</span><input type="number" data-test="squatHoldS"></label>
    </div>
    <button class="btn primary small" data-savetest>Save today's test results</button>
    ${ctx.state.tests.length ? `<div class="table-wrap" style="margin-top:.8rem"><table>
      <thead><tr><th>Date</th><th>Mile</th><th>Push-ups</th><th>Carry</th><th>Squat hold</th></tr></thead>
      <tbody>${ctx.state.tests.slice().reverse().map((t) => `<tr><td>${esc(t.date)}</td>
        <td>${esc(t.mileMin ?? '—')}</td><td>${esc(t.pushups ?? '—')}</td>
        <td>${esc(t.carryM ?? '—')}</td><td>${esc(t.squatHoldS ?? '—')}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
  </section>

  <section class="card">
    <h3>Safety</h3>
    <ul>${data.program.safety.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
  </section>`;
}

function exerciseBlock(ex, phase, w, date) {
  const setCount = phase.setsPerExercise;
  const logged = w.log?.[ex.name] || [];
  return `<div class="card" style="box-shadow:none;margin:.6rem 0 0">
    <div class="spread"><b>${esc(ex.name)}</b><span class="tiny dim">${esc(ex.sets)} × ${esc(ex.reps)}</span></div>
    <div class="item-sub">${esc(ex.targets)}</div>
    <div class="item-sub dim">${esc(ex.cue)}</div>
    <div class="row" style="margin-top:.4rem">
      ${Array.from({ length: setCount }, (_, i) => `
        <span class="row" style="gap:.2rem">
          <input type="number" inputmode="decimal" placeholder="lb" style="width:4.4rem"
            data-set="${esc(ex.name)}" data-i="${i}" data-f="w" value="${esc(logged[i]?.w ?? '')}">
          <input type="number" inputmode="numeric" placeholder="reps" style="width:4.4rem"
            data-set="${esc(ex.name)}" data-i="${i}" data-f="r" value="${esc(logged[i]?.r ?? '')}">
        </span>`).join('')}
    </div>
  </div>`;
}

export function bindTrain(root, ctx) {
  on(root, '[data-session]', 'click', (e) => {
    ctx.ui.session = e.target.dataset.session;
    ctx.refresh();
  });
  on(root, '[data-set]', 'change', (e) => {
    const { set, i, f } = e.target.dataset;
    S.logSet(ctx.today, set, Number(i), { [f]: e.target.value === '' ? undefined : Number(e.target.value) });
  });
  on(root, '[data-done]', 'change', (e) => {
    const slot = ctx.data.program.weeklyTemplate.find((d) => d.day === ctx.pos.dayName);
    S.patchWorkout(ctx.today, { done: e.target.checked, session: ctx.ui.session || slot?.session });
    ctx.refresh({ keepScroll: true });
  });
  on(root, '[data-minutes]', 'change', (e) => {
    S.patchWorkout(ctx.today, { minutes: Number(e.target.value) || 0 });
    ctx.refresh({ keepScroll: true });
  });
  on(root, '[data-savetest]', 'click', () => {
    const entry = { date: ctx.today };
    root.querySelectorAll('[data-test]').forEach((el) => {
      if (el.value !== '') entry[el.dataset.test] = Number(el.value);
    });
    if (Object.keys(entry).length > 1) S.addTest(entry);
    ctx.refresh();
  });
}

/* ============================== TRACK ============================== */

export function renderTrack(ctx) {
  const { data, profile, t } = ctx;
  const weights = ctx.state.weights;
  const trend = C.weightTrend(weights, 7);
  const start = weights[0];
  const latest = weights[weights.length - 1];
  const rate = C.ratePerWeek(weights, 28);
  const [lo, hi] = t.healthyLb;
  const x0 = start.date;

  const points = trend.map((w) => ({ x: C.daysBetween(x0, w.date), y: w.lb }));
  const avgPoints = trend.map((w) => ({ x: C.daysBetween(x0, w.date), y: w.avg }));
  const chart = lineChart({
    series: [
      { points, color: 'var(--ink-3)', width: 1, dots: true, opacity: .8 },
      { points: avgPoints, color: 'var(--accent)', width: 2.4 }
    ],
    band: { from: lo, to: hi, label: 'healthy BMI range' },
    lines: [{ y: hi, color: 'var(--good)', label: `BMI 24.9 = ${Math.round(hi)} lb` }],
    xLabels: [
      { x: 0, text: C.fmtDate(x0, { month: 'short', day: 'numeric' }) },
      { x: C.daysBetween(x0, latest.date), text: C.fmtDate(latest.date, { month: 'short', day: 'numeric' }) }
    ]
  });

  const lost = start.lb - latest.lb;
  const pctLost = (lost / start.lb) * 100;
  const rows7 = lastDays(ctx, 7);
  const rows30 = lastDays(ctx, 30);
  const bp = latestBp(ctx);
  const lab = latestLab(ctx);

  const milestones = data.lifestyle.milestones.steps.map((m) => {
    const target = m.pctLoss ? start.lb * (1 - m.pctLoss / 100) : C.lbForBmi(m.bmi, profile.heightIn);
    const done = latest.lb <= target;
    const togo = Math.max(0, latest.lb - target);
    const weeks = C.weeksTo(latest.lb, target, rate ?? -t.lbPerWeek);
    return `<li class="spread">
      <div><b>${done ? '✔ ' : ''}${esc(m.label)}</b>
        <div class="item-sub">${num(target, 1)} lb${done ? '' : ` · ${num(togo, 1)} lb to go`}</div></div>
      <div class="tiny dim">${done ? 'reached' : weeks ? `~${Math.ceil(weeks)} wk` : ''}</div></li>`;
  }).join('');

  return `
  <section class="card">
    <div class="card-head"><div><span class="eyebrow">Weight and body</span><h2>${num(latest.lb, 1)} lb</h2></div>
      ${pill(C.bmiCategory(C.bmi(latest.lb, profile.heightIn)).label,
        C.bmiCategory(C.bmi(latest.lb, profile.heightIn)).tone)}</div>
    ${chart}
    <div class="metrics" style="margin-top:.6rem">
      ${metric('Change',
        weights.length < 2 ? '—' : `${lost >= 0 ? '−' : '+'}${num(Math.abs(lost), 1)}`,
        weights.length < 2 ? '' : 'lb',
        `<div class="tiny dim">${weights.length < 2 ? 'one weigh-in so far'
          : `${num(Math.abs(pctLost), 1)}% since ${esc(C.fmtDate(start.date, { month: 'short', day: 'numeric' }))}`}</div>`)}
      ${metric('Trend', rate === null ? '—' : `${rate <= 0 ? '−' : '+'}${num(Math.abs(rate), 2)}`, 'lb/wk',
        `<div class="tiny dim">${rate === null ? 'needs 4+ weigh-ins' : 'last 28 days'}</div>`)}
      ${metric('BMI', num(C.bmi(latest.lb, profile.heightIn), 1))}
      ${metric('Healthy range', `${Math.round(lo)}–${Math.round(hi)}`, 'lb')}
      ${metric('Planned pace', num(t.lbPerWeek, 1), 'lb/wk', `<div class="tiny dim">${num(t.deficit)} kcal/day gap</div>`)}
      ${metric('7-day average', num(trend[trend.length - 1].avg, 1), 'lb')}
    </div>
    <p class="tiny dim" style="margin-top:.5rem">The thick line is the 7-day average — that is the one to
      read. Daily weight swings by 2–4 lb on salt, fluid and what is still in your gut.
      CDC's guidance is ${C.GUIDE.lossLbPerWeek[0]}–${C.GUIDE.lossLbPerWeek[1]} lb a week; the projections
      below use your own measured trend when there is enough data, and the planned pace before that.</p>
    ${sourceLine(data.sources, ['cdcBmi', 'cdcWeightLoss'])}
  </section>

  <section class="card">
    <h3>Milestones</h3>
    <p class="tiny dim">${esc(data.lifestyle.milestones.note)}</p>
    <ul class="list">${milestones}</ul>
    ${sourceLine(data.sources, ['nhlbiWeight'])}
  </section>

  <section class="card">
    <h3>Add or correct a weigh-in</h3>
    <div class="grid2">
      <label class="field"><span>Date</span><input type="date" data-wdate value="${esc(ctx.today)}"></label>
      <label class="field"><span>Weight (lb)</span><input type="number" step="0.1" inputmode="decimal" data-wlb></label>
    </div>
    <button class="btn primary small" data-addweight>Save</button>
    <details class="disclose"><summary>All weigh-ins (${weights.length})</summary><div>
      <div class="table-wrap"><table><thead><tr><th>Date</th><th>lb</th><th>7-day avg</th><th></th></tr></thead>
        <tbody>${trend.slice().reverse().map((w) => `<tr><td>${esc(w.date)}</td><td>${num(w.lb, 1)}</td>
          <td>${num(w.avg, 1)}</td><td><button class="btn small ghost" data-delweight="${esc(w.date)}">✕</button></td></tr>`).join('')}
        </tbody></table></div></div></details>
  </section>

  <section class="card">
    <h3>Recovery and daily markers</h3>
    <div class="metrics">
      ${metric('Sleep, 7-day avg', fmtOrDash(avgOf(rows7, (r) => Number(r.log.sleepHours)), 1), 'h',
        `<div class="tiny dim">target ${C.GUIDE.sleepHours[0]}–${C.GUIDE.sleepHours[1]}</div>`)}
      ${metric('Resting HR, 7-day avg', fmtOrDash(avgOf(rows7, (r) => Number(r.log.restingHr)), 0), 'bpm')}
      ${metric('Steps, 7-day avg', fmtOrDash(avgOf(rows7, (r) => Number(r.log.steps)), 0))}
      ${metric('Waist, latest', fmtOrDash(latestOf(rows30, (r) => Number(r.log.waistIn)), 1), 'in',
        `<div class="tiny dim">under ${C.GUIDE.waistMaxIn} in</div>`)}
      ${metric('Blood pressure', bp ? `${bp.sys}/${bp.dia}` : '—', '',
        `<div class="tiny dim">${bp ? esc(bp.date) : 'not logged'}</div>`)}
      ${metric('Fluid, 7-day avg', fmtOrDash(avgOf(rows7, (r) => {
        const l = r.log || {};
        return N.drinkMlLogged(data.plan, l) + (l.waterMl || 0);
      }), 0), 'ml')}
    </div>
    ${sleepChart(ctx, rows30)}
  </section>

  <section class="card">
    <h3>Bloodwork</h3>
    <p class="tiny dim">Enter results from your clinician. These four rows plus blood pressure are the
      inputs this app cannot measure for you, and they are the ones that matter most for the long run.</p>
    ${lab ? `<div class="table-wrap"><table>
      <thead><tr><th>Marker</th><th>Latest</th><th>Target</th></tr></thead><tbody>
      ${[['Total cholesterol', lab.totalChol, `under ${C.GUIDE.lipids.totalChol}`],
         ['LDL', lab.ldl, `under ${C.GUIDE.lipids.ldl}`],
         ['HDL', lab.hdl, `${C.GUIDE.lipids.hdlMin} or above`],
         ['Triglycerides', lab.triglycerides, `under ${C.GUIDE.lipids.triglycerides}`],
         ['Fasting glucose', lab.glucose, `under ${C.GUIDE.glucose.fasting}`],
         ['A1c (%)', lab.a1c, `under ${C.GUIDE.glucose.a1c}`],
         ['VO2 max', lab.vo2max, `above ${C.GUIDE.vo2LowMen}`]]
        .map(([k, v, target]) => `<tr><td>${esc(k)}</td><td>${v ?? '—'}</td><td class="dim">${esc(target)}</td></tr>`).join('')}
      </tbody></table></div><p class="tiny dim">Drawn ${esc(lab.date)}.</p>` : '<p class="muted">No results saved yet.</p>'}
    <details class="disclose"><summary>Add a set of results</summary><div>
      <div class="grid2">
        <label class="field"><span>Date</span><input type="date" data-lab="date" value="${esc(ctx.today)}"></label>
        <label class="field"><span>Total cholesterol</span><input type="number" data-lab="totalChol"></label>
        <label class="field"><span>LDL</span><input type="number" data-lab="ldl"></label>
        <label class="field"><span>HDL</span><input type="number" data-lab="hdl"></label>
        <label class="field"><span>Triglycerides</span><input type="number" data-lab="triglycerides"></label>
        <label class="field"><span>Fasting glucose</span><input type="number" data-lab="glucose"></label>
        <label class="field"><span>A1c (%)</span><input type="number" step="0.1" data-lab="a1c"></label>
        <label class="field"><span>VO2 max</span><input type="number" step="0.1" data-lab="vo2max"></label>
      </div>
      <button class="btn primary small" data-savelab>Save results</button>
    </div></details>
    ${sourceLine(data.sources, ['cdcCholesterol', 'cdcA1c', 'ahaCrf'])}
  </section>`;
}

function fmtOrDash(v, dp) { return v === null || v === undefined ? '—' : num(v, dp); }

function latestOf(rows, pick) {
  for (const r of rows) {
    const v = pick(r);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

function sleepChart(ctx, rows) {
  const pts = rows.slice().reverse()
    .map((r) => ({ x: -C.daysBetween(ctx.today, r.date), y: Number(r.log.sleepHours) }))
    .filter((p) => Number.isFinite(p.y) && p.y > 0);
  if (pts.length < 2) return '<p class="tiny dim">Log sleep for a few days to see the trend here.</p>';
  return lineChart({
    series: [{ points: pts, color: 'var(--accent)', width: 2, dots: true }],
    lines: [{ y: C.GUIDE.sleepHours[0], color: 'var(--warn)', label: '7 h floor' }],
    height: 150, yPad: 0.6
  });
}

export function bindTrack(root, ctx) {
  on(root, '[data-addweight]', 'click', () => {
    const date = root.querySelector('[data-wdate]').value || ctx.today;
    const lb = root.querySelector('[data-wlb]').value;
    if (lb !== '') S.logWeight(date, lb);
    ctx.refresh();
  });
  on(root, '[data-delweight]', 'click', (e) => {
    if (ctx.state.weights.length > 1) S.removeWeight(e.target.dataset.delweight);
    ctx.refresh();
  });
  on(root, '[data-savelab]', 'click', () => {
    const entry = {};
    root.querySelectorAll('[data-lab]').forEach((el) => {
      if (el.value !== '') entry[el.dataset.lab] = el.dataset.lab === 'date' ? el.value : Number(el.value);
    });
    entry.date ||= ctx.today;
    if (Object.keys(entry).length > 1) S.addLab(entry);
    ctx.refresh();
  });
}

/* ============================== LONGEVITY ============================== */

export function renderLongevity(ctx) {
  const { data, profile, t } = ctx;
  const rows7 = lastDays(ctx, 7);
  const rows28 = lastDays(ctx, 28);
  const latest = ctx.latestWeight;
  const lab = latestLab(ctx);
  const bp = latestBp(ctx);

  const mealsPossible = rows7.length * 3;
  const mealsDone = rows7.reduce((s, r) => s + ['lunch', 'snack', 'dinner']
    .filter((k) => r.log.meals?.[k]).length, 0);
  const aerobic = rows7.reduce((s, r) => s + (Number(r.workout.minutes) || 0), 0);
  const strength = rows7.filter((r) => r.workout.done && ['A', 'B', 'C'].includes(r.workout.session)).length;
  const sleepAvg = avgOf(rows7, (r) => Number(r.log.sleepHours));
  const nicotineClean = rows7.filter((r) => r.log.habits?.nicotine).length;
  const bmiNow = C.bmi(latest.lb, profile.heightIn);

  const anyMealLog = rows7.some((r) => r.log.meals && Object.values(r.log.meals).some(Boolean));
  const anyWorkoutLog = rows7.some((r) => r.workout.done || Number(r.workout.minutes) > 0);
  const anyHabitLog = rows7.some((r) => r.log.habits && Object.keys(r.log.habits).length);

  const comp = {
    diet: anyMealLog
      ? score(mealsDone / (mealsPossible || 1) >= 0.8, mealsDone / (mealsPossible || 1) >= 0.5,
        `${mealsDone} of ${mealsPossible} planned meals ticked off this week`)
      : score(null, null, 'Nothing ticked off yet this week — start on the Today tab'),
    activity: anyWorkoutLog
      ? score(aerobic >= C.GUIDE.aerobicMinutes[0] && strength >= C.GUIDE.strengthDays,
        aerobic >= 75 || strength >= 1,
        `${Math.round(aerobic)} aerobic minutes and ${strength} strength sessions in the last 7 days`)
      : score(null, null, 'No sessions logged yet this week'),
    nicotine: anyHabitLog
      ? score(nicotineClean >= 6, nicotineClean >= 3,
        nicotineClean >= 6 ? 'Nicotine-free every day logged this week' : `Logged nicotine-free on ${nicotineClean} of 7 days`)
      : score(null, null, 'Tick the nicotine-free habit each day to track this'),
    sleep: sleepAvg === null
      ? score(null, null, 'No sleep logged yet')
      : score(sleepAvg >= 7, sleepAvg >= 6, `${sleepAvg.toFixed(1)} h average over 7 days`),
    bmi: score(bmiNow < 25, bmiNow < 30, `BMI ${bmiNow.toFixed(1)} at ${num(latest.lb, 1)} lb`),
    lipids: lab?.ldl ? score(lab.ldl < C.GUIDE.lipids.ldl, lab.ldl < 130,
      `LDL ${lab.ldl} mg/dL, HDL ${lab.hdl ?? '—'}, triglycerides ${lab.triglycerides ?? '—'} (${lab.date})`)
      : score(null, null, 'No lipid panel saved — ask at your next appointment'),
    glucose: lab?.a1c || lab?.glucose ? score(
      (lab.a1c ?? 0) < C.GUIDE.glucose.a1c && (lab.glucose ?? 0) < C.GUIDE.glucose.fasting,
      (lab.a1c ?? 0) < 6.5 && (lab.glucose ?? 0) < 126,
      `A1c ${lab.a1c ?? '—'}%, fasting glucose ${lab.glucose ?? '—'} mg/dL (${lab.date})`)
      : score(null, null, 'No glucose result saved — worth asking for, given a BMI above 25'),
    bp: bp ? score(bp.sys < 120 && bp.dia < 80, bp.sys < 130 && bp.dia < 80,
      `${bp.sys}/${bp.dia} mm Hg on ${bp.date}`)
      : score(null, null, 'No reading logged — a home cuff is about the price of two takeaways')
  };

  const onTarget = Object.values(comp).filter((c) => c.tone === 'ok').length;
  const known = Object.values(comp).filter((c) => c.tone !== '').length;

  return `
  <section class="card">
    <div class="card-head"><div><span class="eyebrow">The eight that move healthspan</span>
      <h2>${onTarget} of ${known} on target</h2></div>
      ${pill(`${Object.values(comp).filter((c) => c.tone === '').length} unknown`)}</div>
    <p class="muted" style="margin:0">${esc(data.lifestyle.longevity.framework)}</p>
    ${sourceLine(data.sources, ['le8'])}
  </section>

  ${data.lifestyle.longevity.components.map((c) => {
    const st = comp[c.id];
    return `<section class="card">
      <div class="card-head"><h3>${esc(c.label)}</h3>
        ${pill(st.tone === 'ok' ? 'on target' : st.tone === '' ? 'unknown'
          : st.tone === 'warn' ? 'close' : 'off target', st.tone)}</div>
      <p style="margin:0"><b>${esc(st.detail)}</b></p>
      <p class="muted tiny" style="margin:.3rem 0 0">Target: ${esc(c.target)}</p>
      ${sourceLine(data.sources, [c.source])}
    </section>`;
  }).join('')}

  <section class="card">
    <h3>Screening and check-ups</h3>
    <ul class="list">
      ${data.lifestyle.screening.map((s) => `<li>
        <div class="item-title">${esc(s.what)}</div>
        <div class="item-sub"><b>${esc(s.when)}</b></div>
        <div class="item-sub dim">${esc(s.why)}</div>
        ${s.source ? sourceLine(data.sources, [s.source]) : ''}</li>`).join('')}
    </ul>
  </section>

  <section class="card">
    <h3>Hydration</h3>
    <p class="tiny dim">${esc(data.lifestyle.hydration.note)}</p>
    <ul>${data.lifestyle.hydration.cues.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    ${sourceLine(data.sources, [data.lifestyle.hydration.source])}
  </section>

  <section class="card">
    <h3>Sleep routine</h3>
    <p class="tiny dim">${esc(data.lifestyle.sleep.note)}</p>
    <ul class="list">
      ${data.lifestyle.sleep.routine.map((r) => `<li><div class="spread">
        <div><b>${esc(r.time)}</b> ${esc(r.do)}</div></div>
        <div class="item-sub dim">${esc(r.why)}</div></li>`).join('')}
    </ul>
    <details class="disclose"><summary>Bedroom and habits</summary><div>
      <ul>${data.lifestyle.sleep.environment.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
    </div></details>
    ${sourceLine(data.sources, data.lifestyle.sleep.sources)}
  </section>

  <section class="card">
    <h3>Five things worth remembering</h3>
    <ul>${data.lifestyle.principles.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </section>

  <section class="card">
    <h3>Habit streaks, last 28 days</h3>
    ${data.lifestyle.habits.map((h) => {
      const hit = rows28.filter((r) => r.log.habits?.[h.id]).length;
      return progressRow(h.label, hit, 28, ' days', hit < 14 ? 'warn' : '');
    }).join('')}
  </section>`;
}

function score(ok, partial, detail) {
  if (ok === null) return { tone: '', detail };
  return { tone: ok ? 'ok' : partial ? 'warn' : 'bad', detail };
}

/* ============================== FIRST RUN ============================== */

export function renderSetup(ctx) {
  const p = ctx.profile;
  return `
  <section class="card">
    <span class="eyebrow">First run</span>
    <h2>Tell the app about you</h2>
    <p class="muted">Entered once, and they stay in this browser — no account, no server, nothing
      leaves the device. Everything else in the app is worked out from these.</p>
    <div class="grid2">
      <label class="field"><span>Date of birth</span>
        <input type="date" data-s="dob" value="${esc(p.dob)}"></label>
      <label class="field"><span>Sex (for the metabolic rate equation)</span>
        <select data-s="sex">
          <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
          <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
        </select></label>
      <label class="field"><span>Height (inches)</span>
        <input type="number" step="0.5" inputmode="decimal" data-s="heightIn" value="${esc(p.heightIn)}"></label>
      <label class="field"><span>Weight today (lb)</span>
        <input type="number" step="0.1" inputmode="decimal" data-s="startWeightLb" value="${esc(p.startWeightLb)}"></label>
      <label class="field"><span>Activity level</span>
        <select data-s="activity">
          ${C.ACTIVITY.map((a) => `<option value="${a.v}" ${Number(p.activity) === a.v ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}
        </select></label>
      <label class="field"><span>Daily calorie gap</span>
        <select data-s="deficitKcal">
          ${[250, 500, 750].map((d) => `<option value="${d}" ${Number(p.deficitKcal) === d ? 'selected' : ''}>
            ${d} kcal ≈ ${(d * 7 / 3500).toFixed(1)} lb/week</option>`).join('')}
        </select></label>
      <label class="field"><span>Eating window opens</span>
        <input type="time" data-s="eatFrom" value="${esc(p.eatFrom)}"></label>
      <label class="field"><span>Eating window closes</span>
        <input type="time" data-s="eatTo" value="${esc(p.eatTo)}"></label>
    </div>
    <p class="tiny dim">A 500 kcal daily gap is the standard starting point for about a pound a week,
      which is inside CDC's 1–2 lb range. You can change any of this later under Sources → Settings.</p>
    <button class="btn primary" data-startapp>Build my plan</button>
  </section>

  <section class="card">
    <h3>What you are about to get</h3>
    <ul>
      <li>A 4-week rotating menu written to the 2,000-calorie pattern in the Dietary Guidelines for
        Americans 2025–2030, with every calorie and gram traced to USDA FoodData Central.</li>
      <li>A weekly bulk shopping list generated from those menus.</li>
      <li>A drink schedule with a caffeine cut-off, and a 16:8 eating window with a live countdown.</li>
      <li>A 12-week home strength and aerobic programme built on the Physical Activity Guidelines
        and ACSM's 2026 resistance-training position stand.</li>
      <li>Weight, sleep, blood-pressure and bloodwork tracking against published thresholds.</li>
    </ul>
    <p class="note warn">This is a planner, not medical advice. Talk to a clinician before starting if
      you take prescription medicine or have any diagnosed condition.</p>
  </section>`;
}

export function bindSetup(root, ctx) {
  on(root, '[data-startapp]', 'click', () => {
    const p = {};
    root.querySelectorAll('[data-s]').forEach((el) => {
      const key = el.dataset.s;
      const numeric = ['heightIn', 'startWeightLb', 'activity', 'deficitKcal'];
      p[key] = numeric.includes(key) ? Number(el.value) : el.value;
    });
    p.startDate = ctx.today;
    if (!p.dob || !p.heightIn || !p.startWeightLb) {
      alert('Date of birth, height and weight are needed before the plan can be sized.');
      return;
    }
    S.completeSetup(p);
    ctx.go('today');
  });
}

/* ============================== SOURCES & SETTINGS ============================== */

export function renderLearn(ctx) {
  const { data, profile, t } = ctx;
  const src = data.sources.sources;
  return `
  <section class="card">
    <h2>Where every number comes from</h2>
    <p class="muted">${esc(data.sources.note)}</p>
    <p class="tiny dim">Retrieved ${esc(data.sources.retrieved)}. Guidance changes — if a source has been
      revised since then, the source wins, not this app.</p>
  </section>

  ${Object.entries(src).map(([id, s]) => `
    <section class="card">
      <div class="card-head"><h3>${esc(s.title)}</h3><span class="eyebrow">${esc(id)}</span></div>
      <p class="item-sub">${esc(s.publisher)}${s.date ? ` · ${esc(s.date)}` : ''}</p>
      <p style="margin:.4rem 0"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></p>
      <details class="disclose"><summary>What this app takes from it (${s.usedFor.length})</summary><div>
        <ul>${s.usedFor.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>
        ${s.note ? `<p class="note">${esc(s.note)}</p>` : ''}
      </div></details>
    </section>`).join('')}

  <section class="card">
    <h3>Your numbers, and how they are worked out</h3>
    <div class="table-wrap"><table><tbody>
      <tr><td>Age</td><td>${t.age} — from ${esc(profile.dob)}</td></tr>
      <tr><td>Height</td><td>${profile.heightIn} in (${num(C.inToCm(profile.heightIn), 0)} cm)</td></tr>
      <tr><td>BMI</td><td>703 × lb ÷ in² = ${num(t.bmi, 1)}</td></tr>
      <tr><td>Resting metabolic rate</td><td>Mifflin-St Jeor = ${num(t.rmr)} kcal</td></tr>
      <tr><td>Daily burn (TDEE)</td><td>RMR × ${profile.activity} = ${num(t.tdee)} kcal</td></tr>
      <tr><td>Calorie target</td><td>TDEE − ${num(profile.deficitKcal)} = ${num(t.kcal)} kcal</td></tr>
      <tr><td>Expected loss</td><td>${num(t.deficit)} kcal/day ÷ 3,500 × 7 ≈ ${num(t.lbPerWeek, 1)} lb/week</td></tr>
      <tr><td>Protein</td><td>1.2–1.6 g/kg × ${num(t.kg, 1)} kg = ${t.proteinG[0]}–${t.proteinG[1]} g</td></tr>
      <tr><td>Saturated fat cap</td><td>10% of ${num(t.kcal)} kcal ÷ 9 = ${t.satFatMaxG} g</td></tr>
      <tr><td>Healthy weight range</td><td>BMI 18.5–24.9 = ${num(t.healthyLb[0], 0)}–${num(t.healthyLb[1], 0)} lb</td></tr>
    </tbody></table></div>
    <p class="tiny dim">The 3,500 kcal per pound figure is a rough rule of thumb, not physiology.
      Treat the projections as direction of travel and trust the scale trend over the arithmetic.</p>
  </section>

  <section class="card">
    <h3>Settings</h3>
    <div class="grid2">
      <label class="field"><span>Date of birth</span><input type="date" data-p="dob" value="${esc(profile.dob)}"></label>
      <label class="field"><span>Height (inches)</span><input type="number" step="0.5" data-p="heightIn" value="${esc(profile.heightIn)}"></label>
      <label class="field"><span>Eating window opens</span><input type="time" data-p="eatFrom" value="${esc(profile.eatFrom)}"></label>
      <label class="field"><span>Eating window closes</span><input type="time" data-p="eatTo" value="${esc(profile.eatTo)}"></label>
      <label class="field"><span>Wake</span><input type="time" data-p="wake" value="${esc(profile.wake)}"></label>
      <label class="field"><span>Bed</span><input type="time" data-p="bed" value="${esc(profile.bed)}"></label>
      <label class="field"><span>Menu rotation starts</span><input type="date" data-p="planStart" value="${esc(profile.planStart)}"></label>
      <label class="field"><span>Daily calorie gap</span>
        <select data-p="deficitKcal">
          ${[250, 500, 750].map((d) => `<option value="${d}" ${Number(profile.deficitKcal) === d ? 'selected' : ''}>
            ${d} kcal ≈ ${(d * 7 / 3500).toFixed(1)} lb/week</option>`).join('')}
        </select></label>
    </div>
    <label class="field"><span>Activity level</span>
      <select data-p="activity">
        ${C.ACTIVITY.map((a) => `<option value="${a.v}" ${Number(profile.activity) === a.v ? 'selected' : ''}>
          ${esc(a.label)}</option>`).join('')}
      </select></label>
    <label class="field"><span>Appearance</span>
      <select data-p="theme">
        ${['auto', 'light', 'dark'].map((th) => `<option value="${th}" ${profile.theme === th ? 'selected' : ''}>${th}</option>`).join('')}
      </select></label>
  </section>

  <section class="card">
    <h3>Your data</h3>
    <p class="tiny dim">Everything is stored in this browser only. Export a copy before clearing site data,
      changing phone, or if you just want a backup.</p>
    <div class="row">
      <button class="btn small" data-export>Export a backup</button>
      <button class="btn small" data-importbtn>Import a backup</button>
      <button class="btn small ghost" data-reset>Erase everything</button>
    </div>
    <textarea data-importbox rows="4" placeholder="Paste a backup here, then press Import" style="margin-top:.6rem;display:none"></textarea>
  </section>

  <section class="card">
    <h3>What this app is not</h3>
    <p>It is a planner and a log built on public guidance from USDA, HHS, CDC, NIH, the National
      Academies, the American Heart Association and the American College of Sports Medicine. It is not
      medical advice, it cannot examine you, and it does not know your medical history or medications.</p>
    <p>Talk to a clinician before starting if you take any prescription medicine, have diabetes, heart
      disease, kidney disease or high blood pressure, or have any history of disordered eating. Stop and
      seek advice if you get chest pain, unusual breathlessness, fainting, or persistent dizziness.</p>
  </section>`;
}

export function bindLearn(root, ctx) {
  on(root, '[data-p]', 'change', (e) => {
    const key = e.target.dataset.p;
    const raw = e.target.value;
    const numeric = ['heightIn', 'activity', 'deficitKcal'];
    S.patchProfile({ [key]: numeric.includes(key) ? Number(raw) : raw });
    ctx.refresh();
  });
  on(root, '[data-export]', 'click', () => {
    const box = root.querySelector('[data-importbox]');
    box.style.display = 'block';
    box.value = S.exportJson();
    box.select();
  });
  on(root, '[data-importbtn]', 'click', () => {
    const box = root.querySelector('[data-importbox]');
    if (box.style.display === 'none') { box.style.display = 'block'; box.focus(); return; }
    try {
      S.importJson(box.value);
      ctx.refresh();
    } catch (err) {
      alert('That does not look like a Healthy Living backup: ' + err.message);
    }
  });
  on(root, '[data-reset]', 'click', () => {
    if (confirm('Erase every logged weight, meal, workout and lab result on this device?')) {
      S.resetAll();
      ctx.refresh();
    }
  });
}
