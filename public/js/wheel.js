// SVG-колесо натальной карты.
import { SIGNS, PLANETS, signOf } from './astro/format.js';
import { norm360 } from './astro/core.js';
import { ASPECTS } from './astro/aspects.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const text = (parent, x, y, str, cls, size) => {
  const t = el('text', { x, y, class: cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, parent);
  if (size) t.setAttribute('font-size', size);
  t.textContent = str;
  return t;
};

// Экранный угол точки: ASC строго слева (9 часов), долготы растут против часовой
function makeProj(asc, cx, cy) {
  return (lon, r) => {
    const phi = (asc - lon + 180) * Math.PI / 180;
    return { x: cx + r * Math.cos(phi), y: cy - r * Math.sin(phi) };
  };
}

const ELEMENT_FILL = { fire: 'rgba(255,107,107,.10)', earth: 'rgba(92,232,160,.09)', air: 'rgba(255,209,102,.09)', water: 'rgba(143,123,255,.12)' };
const ASP_COLOR = { conjunction: '#ffd166', sextile: '#5ce8a0', trine: '#5ce8a0', square: '#ff6b6b', opposition: '#ff6b6b' };

export function drawWheel(svg, { points, cusps, asc, mc, aspects }) {
  svg.innerHTML = '';
  const W = 760, H = 760, cx = W / 2, cy = H / 2;
  const R_OUT = 346, R_SIGN_IN = 288, R_GLYPH = 314, R_CUSP_IN = 210, R_PLANET = 168, R_CENTER = 118;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const proj = makeProj(asc, cx, cy);

  // зодиакальное кольцо
  for (let s = 0; s < 12; s++) {
    const p = [proj(s * 30, R_SIGN_IN), proj(s * 30, R_OUT), proj((s + 1) * 30, R_OUT), proj((s + 1) * 30, R_SIGN_IN)];
    const path = `M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y} A ${R_OUT} ${R_OUT} 0 0 1 ${p[2].x} ${p[2].y} L ${p[3].x} ${p[3].y} A ${R_SIGN_IN} ${R_SIGN_IN} 0 0 0 ${p[0].x} ${p[0].y} Z`;
    el('path', { d: path, fill: ELEMENT_FILL[SIGNS[s].element], stroke: 'rgba(255,255,255,.10)', 'stroke-width': 1 }, svg);
    const mid = proj(s * 30 + 15, R_GLYPH);
    text(svg, mid.x, mid.y, SIGNS[s].glyph, 'wheel-sign', 22);
    // градусные риски каждые 5°
    for (let g = 0; g < 6; g++) {
      const l1 = proj(s * 30 + g * 5, R_SIGN_IN), l2 = proj(s * 30 + g * 5, R_SIGN_IN + 6);
      el('line', { x1: l1.x, y1: l1.y, x2: l2.x, y2: l2.y, stroke: 'rgba(255,255,255,.25)', 'stroke-width': 1 }, svg);
    }
  }
  el('circle', { cx, cy, r: R_OUT, fill: 'none', stroke: 'rgba(255,209,102,.35)', 'stroke-width': 1.4 }, svg);
  el('circle', { cx, cy, r: R_SIGN_IN, fill: 'none', stroke: 'rgba(255,255,255,.14)', 'stroke-width': 1 }, svg);
  el('circle', { cx, cy, r: R_CUSP_IN, fill: 'rgba(10,12,22,.55)', stroke: 'rgba(255,255,255,.10)', 'stroke-width': 1 }, svg);

  // куспиды домов
  for (let h = 1; h <= 12; h++) {
    const isAngle = (h === 1 || h === 10);
    const p1 = proj(cusps[h], R_CUSP_IN), p2 = proj(cusps[h], R_SIGN_IN + 2);
    el('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      stroke: isAngle ? 'rgba(255,209,102,.75)' : 'rgba(154,160,195,.35)',
      'stroke-width': isAngle ? 2 : 1,
    }, svg);
    // номер дома — в середине дома
    const next = cusps[h === 12 ? 1 : h + 1];
    const span = norm360(next - cusps[h]);
    const mid = proj(norm360(cusps[h] + span / 2), R_CUSP_IN + 16);
    text(svg, mid.x, mid.y, String(h), 'wheel-house-num', 11);
    // градусы куспида
    const d = cusps[h] % 30;
    const lp = proj(cusps[h], R_SIGN_IN + 14);
    const rot = 360 - (asc - cusps[h]); // выравнивание по радиусу
    const t = text(svg, lp.x, lp.y, `${Math.floor(d)}°`, 'wheel-cusp-deg', 9);
    t.setAttribute('transform', `rotate(${90 - rot}, ${lp.x}, ${lp.y})`);
  }

  // метки ASC / MC
  const pa = proj(asc, R_OUT + 16); text(svg, pa.x, pa.y, 'ASC', 'wheel-angle', 13);
  const pm = proj(mc, R_OUT + 16); text(svg, pm.x, pm.y, 'MC', 'wheel-angle', 13);

  // аспектные линии в центре
  const lonById = {};
  for (const p of points) lonById[p.id] = p.lon;
  for (const a of aspects) {
    if (!(a.a in lonById) || !(a.b in lonById)) continue;
    const p1 = proj(lonById[a.a], R_CENTER), p2 = proj(lonById[a.b], R_CENTER);
    el('line', {
      x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
      stroke: ASP_COLOR[a.aspect.id], 'stroke-width': a.aspect.id === 'conjunction' ? 2.2 : 1.4,
      opacity: 0.55, 'stroke-dasharray': a.aspect.nature === 1 ? 'none' : (a.aspect.id === 'conjunction' ? 'none' : '5 4'),
    }, svg);
  }

  // планеты: раскладка с защитой от наложения
  const items = points.map(p => ({ ...p }));
  items.sort((a, b) => norm360(a.lon - asc) - norm360(b.lon - asc));
  const MIN_GAP = 11; // минимальный экранный разнос, градусов
  let prev = -Infinity;
  for (const it of items) {
    let disp = norm360(it.lon - asc);
    if (disp < prev + MIN_GAP && disp < 360 - MIN_GAP / 2) disp = prev + MIN_GAP;
    it.dispLon = norm360(asc + disp);
    prev = disp;
  }
  for (const it of items) {
    const g = PLANETS[it.id] || { glyph: '?', color: '#fff', name: it.id };
    const at = proj(it.dispLon, R_PLANET);
    // указатель к истинной позиции, если сдвинули
    if (Math.abs(norm360(it.dispLon - it.lon + 180) - 180) > 1.5) {
      const a1 = proj(it.dispLon, R_PLANET - 12), a2 = proj(it.lon, R_CUSP_IN + 4);
      el('line', { x1: a1.x, y1: a1.y, x2: a2.x, y2: a2.y, stroke: 'rgba(255,255,255,.18)', 'stroke-width': 1 }, svg);
    }
    const c = el('circle', { cx: at.x, cy: at.y, r: 13, fill: 'rgba(26,30,61,.92)', stroke: g.color, 'stroke-width': 1.4, class: 'wheel-planet' }, svg);
    const tt = el('title', {}, c); tt.textContent = `${g.name}: ${signOf(it.lon).name} ${Math.floor(it.lon % 30)}°${it.retro ? ' R' : ''}`;
    const t = text(svg, at.x, at.y + 0.5, g.glyph, 'wheel-planet-glyph', 14);
    t.setAttribute('fill', g.color);
    if (it.retro) text(svg, at.x + 12, at.y - 9, 'R', 'wheel-retro', 9).setAttribute('fill', '#ff6b6b');
  }
}
