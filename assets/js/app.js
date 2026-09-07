/* Bootstrap: load the plan data, work out today's numbers, render the active tab. */

import * as S from './store.js';
import * as C from './calc.js';
import { esc } from './ui.js';
import { renderToday, bindToday, renderPlan, bindPlan, renderShop, bindShop } from './views-core.js';
import {
  renderTrain, bindTrain, renderTrack, bindTrack,
  renderLongevity, renderLearn, bindLearn, renderSetup, bindSetup
} from './views-more.js';

const FILES = {
  foods: 'data/foods.json',
  meals: 'data/meals.json',
  plan: 'data/plan.json',
  program: 'data/program.json',
  lifestyle: 'data/lifestyle.json',
  sources: 'data/sources.json'
};

const VIEWS = {
  today: { render: renderToday, bind: bindToday, title: 'Today' },
  plan: { render: renderPlan, bind: bindPlan, title: 'Menu plan' },
  shop: { render: renderShop, bind: bindShop, title: 'Shopping' },
  train: { render: renderTrain, bind: bindTrain, title: 'Training' },
  track: { render: renderTrack, bind: bindTrack, title: 'Tracking' },
  long: { render: renderLongevity, bind: null, title: 'Longevity' },
  learn: { render: renderLearn, bind: bindLearn, title: 'Sources' },
  setup: { render: renderSetup, bind: bindSetup, title: 'Setup' }
};

const el = {
  boot: document.getElementById('boot'),
  bootHint: document.getElementById('boot-hint'),
  view: document.getElementById('view'),
  tabbar: document.getElementById('tabbar'),
  sub: document.getElementById('topbar-sub'),
  fast: document.getElementById('fast-pill')
};

const uiState = {};
let data = null;
let current = location.hash.replace('#', '') || 'today';
if (!VIEWS[current]) current = 'today';

async function loadData() {
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, path]) => {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
    return [key, await res.json()];
  }));
  return Object.fromEntries(entries);
}

function buildContext() {
  const state = S.get();
  const profile = state.profile;
  const today = C.todayIso();
  const weights = state.weights;
  const latestWeight = weights[weights.length - 1] || { date: today, lb: profile.startWeightLb };
  const t = C.targets(profile, latestWeight.lb);
  return {
    data, state, profile, today, t,
    latestWeight,
    pos: C.planPosition(profile, today),
    ui: uiState,
    refresh,
    go
  };
}

function applyTheme(profile) {
  const root = document.documentElement;
  if (profile.theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', profile.theme);
}

function renderChrome(ctx) {
  const fast = C.fastState(ctx.profile, new Date());
  el.sub.textContent = `${VIEWS[current].title} · ${C.fmtDate(ctx.today, { weekday: 'short', month: 'short', day: 'numeric' })}`
    + ` · wk ${ctx.pos.weekNumber}/4`;
  el.fast.innerHTML = `<b>${esc(fast.eating ? 'Window open' : 'Fasting')}</b>${esc(fast.detail)}`;
  el.tabbar.hidden = current === 'setup';
  el.tabbar.querySelectorAll('.tab').forEach((tab) => {
    if (tab.dataset.tab === current) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
}

function refresh(opts = {}) {
  const scroll = opts.keepScroll ? window.scrollY : 0;
  const ctx = buildContext();
  applyTheme(ctx.profile);
  const view = VIEWS[current];
  el.view.innerHTML = view.render(ctx);
  if (view.bind) view.bind(el.view, ctx);
  renderChrome(ctx);
  window.scrollTo({ top: scroll });
}

function go(tab) {
  if (!VIEWS[tab]) return;
  current = tab;
  history.replaceState(null, '', `#${tab}`);
  refresh();
  el.view.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

el.tabbar.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) go(tab.dataset.tab);
});

window.addEventListener('hashchange', () => {
  const next = location.hash.replace('#', '');
  if (VIEWS[next] && next !== current) go(next);
});

(async function start() {
  try {
    data = await loadData();
  } catch (err) {
    el.bootHint.innerHTML = `Could not load the plan data (${esc(err.message)}).<br><br>
      The app reads its JSON files over HTTP, so it needs to be served rather than opened
      straight off the disk. Run <code>python -m http.server 8000</code> in the project folder and
      open <code>http://localhost:8000</code> — or use the published GitHub Pages link on your phone.`;
    return;
  }
  // An untracked data/profile.json lets a local copy start pre-filled; on a hosted copy it is
  // simply absent and the app asks for the numbers once, on the device.
  let seed = null;
  try {
    const res = await fetch('data/profile.json', { cache: 'no-cache' });
    if (res.ok) seed = await res.json();
  } catch { /* no local profile — that is the normal case */ }

  S.load(seed);
  el.boot.classList.add('hidden');
  if (S.needsSetup()) current = 'setup';
  refresh();
  // keep the fasting countdown honest without re-rendering the whole view
  setInterval(() => renderChrome(buildContext()), 60000);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is a bonus, not a requirement */ });
  }
})();
