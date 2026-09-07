/* Tiny view helpers: HTML escaping, common blocks, and a dependency-free SVG line chart. */

export function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export const num = (n, dp = 0) => Number(n || 0).toLocaleString(undefined, {
  minimumFractionDigits: dp, maximumFractionDigits: dp
});

export function metric(k, v, u = '', extra = '') {
  return `<div class="metric"><div class="k">${esc(k)}</div>
    <div class="v">${v}${u ? `<span class="u"> ${esc(u)}</span>` : ''}</div>${extra}</div>`;
}

export function bar(value, target, { over = false } = {}) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const cls = over && value > target * 1.02 ? 'bar over' : 'bar';
  return `<div class="${cls}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

export function pill(text, tone = '') {
  return `<span class="pill ${tone}">${esc(text)}</span>`;
}

export function sourceLine(sources, ids, prefix = 'Source') {
  const list = (Array.isArray(ids) ? ids : [ids]).map((id) => sources.sources[id]).filter(Boolean);
  if (!list.length) return '';
  return `<p class="src">${esc(prefix)}: ${list.map((s) =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.publisher)} — ${esc(s.title)}</a>`
  ).join('; ')}</p>`;
}

/**
 * Line chart with an optional shaded band and horizontal goal lines.
 * series: [{points:[{x,y}], color, width, dashed, label}]
 */
export function lineChart({ series, band, lines = [], height = 190, yPad = 1.5, xLabels = [] }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 2) return '<p class="muted tiny">Log at least two entries to see a trend.</p>';
  const W = 340, H = height, L = 34, R = 8, T = 10, B = 22;
  const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
  let minY = Math.min(...ys, ...lines.map((l) => l.y).filter(Number.isFinite));
  let maxY = Math.max(...ys, ...lines.map((l) => l.y).filter(Number.isFinite));
  if (band) { minY = Math.min(minY, band.from); maxY = Math.max(maxY, band.to); }
  minY -= yPad; maxY += yPad;
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const sx = (x) => L + ((x - minX) / (maxX - minX || 1)) * (W - L - R);
  const sy = (y) => T + (1 - (y - minY) / (maxY - minY || 1)) * (H - T - B);

  const parts = [`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">`];

  if (band) {
    parts.push(`<rect x="${L}" y="${sy(band.to).toFixed(1)}" width="${W - L - R}"
      height="${Math.abs(sy(band.from) - sy(band.to)).toFixed(1)}"
      fill="var(--accent-soft)" opacity=".7"></rect>`);
    parts.push(`<text x="${W - R}" y="${(sy(band.to) - 3).toFixed(1)}" text-anchor="end"
      font-size="9" fill="var(--ink-3)">${esc(band.label || '')}</text>`);
  }

  // y axis ticks
  [minY, (minY + maxY) / 2, maxY].forEach((v) => {
    parts.push(`<line x1="${L}" y1="${sy(v).toFixed(1)}" x2="${W - R}" y2="${sy(v).toFixed(1)}"
      stroke="var(--line)" stroke-width=".7"></line>`);
    parts.push(`<text x="${L - 4}" y="${(sy(v) + 3).toFixed(1)}" text-anchor="end" font-size="9"
      fill="var(--ink-3)">${v.toFixed(0)}</text>`);
  });

  lines.forEach((l) => {
    if (!Number.isFinite(l.y)) return;
    parts.push(`<line x1="${L}" y1="${sy(l.y).toFixed(1)}" x2="${W - R}" y2="${sy(l.y).toFixed(1)}"
      stroke="${l.color || 'var(--ink-3)'}" stroke-width="1" stroke-dasharray="4 3"></line>`);
    if (l.label) {
      parts.push(`<text x="${L + 2}" y="${(sy(l.y) - 3).toFixed(1)}" font-size="9"
        fill="${l.color || 'var(--ink-3)'}">${esc(l.label)}</text>`);
    }
  });

  series.forEach((s) => {
    const d = s.points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
    parts.push(`<path d="${d}" fill="none" stroke="${s.color || 'var(--accent)'}"
      stroke-width="${s.width || 2}" stroke-linejoin="round" stroke-linecap="round"
      ${s.dashed ? 'stroke-dasharray="3 3"' : ''} opacity="${s.opacity ?? 1}"></path>`);
    if (s.dots) {
      s.points.forEach((p) => parts.push(`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}"
        r="1.9" fill="${s.color || 'var(--accent)'}" opacity=".8"></circle>`));
    }
  });

  xLabels.forEach((lab) => {
    parts.push(`<text x="${sx(lab.x).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="9"
      fill="var(--ink-3)">${esc(lab.text)}</text>`);
  });

  parts.push('</svg>');
  return parts.join('');
}

/** Simple horizontal progress rows used by the servings and habit blocks. */
export function progressRow(label, value, target, unit = '', tone = '') {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  return `<div style="margin-bottom:.5rem">
    <div class="spread tiny"><span>${esc(label)}</span>
      <span class="${tone === 'warn' ? 'muted' : ''}">${value}${unit} / ${target}${unit}</span></div>
    <div class="bar ${tone === 'warn' ? 'over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div>
  </div>`;
}

export function on(root, selector, event, handler) {
  root.querySelectorAll(selector).forEach((el) => el.addEventListener(event, handler));
}
