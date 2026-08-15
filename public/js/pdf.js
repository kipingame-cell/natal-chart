// Выгрузка полного отчёта в PDF (pdfmake, ленивая загрузка с CDN).
// Оформление — в стиле PDF «Матрицы Судьбы»: обложка, рамка страницы,
// serif-заголовки, ч/б-разделители, колонтитулы.
import { SIGNS, PLANETS, fmtDeg, ELEMENT_NAMES, CROSS_NAMES } from './astro/format.js';
import { PLANET_IN_SIGN, RETRO_TEXT } from './data/texts_planet_sign.js';
import { PLANET_IN_HOUSE } from './data/texts_planet_house.js';
import { ASC_TEXTS, MC_TEXTS, NODE_AXIS, LILITH_IN_SIGN, SELENA_IN_SIGN, PARS_IN_HOUSE, VERTEX_TEXT, CONFIG_TEXTS, ASPECT_NATURE } from './data/texts_angles.js';
import { pairText, PLANET_ABOUT, KARMIC_INTRO } from './data/texts_pairs.js';
import { buildSummary, MAIN_PLANETS } from './summary.js';

const SITE_URL = 'https://kipingame-cell.github.io/natal-chart/';
const CDN = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.12',
  'https://cdn.jsdelivr.net/npm/pdfmake@0.2.12/build',
];
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(src));
    document.head.appendChild(s);
  });
}
async function ensurePdfMake() {
  if (window.pdfMake) return;
  let lastErr = null;
  for (const base of CDN) {
    try {
      await loadScript(`${base}/pdfmake.min.js`);
      await loadScript(`${base}/vfs_fonts.min.js`);
      if (window.pdfMake) return;
    } catch (e) { lastErr = e; }
  }
  throw new Error('Не удалось загрузить PDF-модуль (' + (lastErr?.message || 'сеть') + ')');
}

// PT Serif (кириллица) для заголовков; при недоступности сети — обычный Roboto
let serifReady = null;
function ensureSerif() {
  if (serifReady) return serifReady;
  serifReady = (async () => {
    const toB64 = buf => {
      const b = new Uint8Array(buf);
      let s = '';
      for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      return btoa(s);
    };
    const load = async url => toB64(await (await fetch(url)).arrayBuffer());
    const [reg, bold] = await Promise.all([
      load('https://fonts.gstatic.com/s/ptserif/v19/EJRVQgYoZZY2vCFuvDFR.ttf'),
      load('https://fonts.gstatic.com/s/ptserif/v19/EJRSQgYoZZY2vCFuvAnt65qV.ttf'),
    ]);
    pdfMake.vfs['PTSerif-Regular.ttf'] = reg;
    pdfMake.vfs['PTSerif-Bold.ttf'] = bold;
    pdfMake.fonts = {
      ...(pdfMake.fonts || {}),
      Roboto: { normal: 'Roboto-Regular.ttf', bold: 'Roboto-Medium.ttf', italics: 'Roboto-Italic.ttf', bolditalics: 'Roboto-MediumItalic.ttf' },
      Serif: { normal: 'PTSerif-Regular.ttf', bold: 'PTSerif-Bold.ttf' },
    };
    return true;
  })().catch(() => false);
  return serifReady;
}

// DejaVu Sans (есть все астрологические глифы) — вшиваем в SVG перед растром,
// чтобы значки планет/аспектов не зависели от системных шрифтов устройства
let glyphFontCss = null;
function ensureGlyphFont() {
  if (glyphFontCss) return glyphFontCss;
  glyphFontCss = (async () => {
    const buf = await (await fetch('https://cdn.jsdelivr.net/npm/dejavu-fonts-ttf@2.37.3/ttf/DejaVuSans.ttf')).arrayBuffer();
    const b = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return `@font-face{font-family:'DejaVu Sans';src:url(data:font/ttf;base64,${btoa(s)}) format('truetype')}`;
  })().catch(() => '');
  return glyphFontCss;
}

function renderPng(xml, px) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);
      res(cv.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('svg render'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

/* ---- светлая печатная тема для колеса (PDF — белая страница) ---- */
const LIGHT_FILL = {
  'rgba(255,107,107,.10)': '#f7dfdf', 'rgba(92,232,160,.09)': '#dcefe4',
  'rgba(255,209,102,.09)': '#f7eed6', 'rgba(143,123,255,.12)': '#e7e2f7',
  'rgba(10,12,22,.55)': '#ffffff', 'rgba(26,30,61,.92)': '#ffffff',
};
const LIGHT_STROKE = {
  'rgba(255,255,255,.10)': '#c6c6d2', 'rgba(255,255,255,.14)': '#bdbdca',
  'rgba(255,255,255,.25)': '#b0b0be', 'rgba(255,255,255,.18)': '#cfcfda',
  'rgba(255,209,102,.35)': '#c9a227', 'rgba(255,209,102,.75)': '#b8860b',
  'rgba(154,160,195,.35)': '#9aa0b8',
};
const DARKEN = {
  '#ffd166': '#c99700', '#9aa0c3': '#5b6685', '#4fd1c5': '#0f766e',
  '#5ce8a0': '#1a8f4d', '#ff6b6b': '#c0392b', '#8f7bff': '#5a4fcf',
  '#eceefb': '#333333',
};
const WHEEL_STYLE_LIGHT = `text{font-family:"DejaVu Sans","Segoe UI",sans-serif;fill:#333}`;

// клонируем колесо и перекрашиваем в печатную тему
async function wheelPngLight(svg) {
  const fontCss = await ensureGlyphFont();
  const clone = svg.cloneNode(true);
  clone.setAttribute('width', 760); clone.setAttribute('height', 760);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  st.textContent = fontCss + WHEEL_STYLE_LIGHT;
  clone.insertBefore(st, clone.firstChild);
  for (const e of clone.querySelectorAll('*')) {
    if (e.tagName === 'title') { e.remove(); continue; }
    const f = e.getAttribute('fill'), s = e.getAttribute('stroke');
    if (f && LIGHT_FILL[f]) e.setAttribute('fill', LIGHT_FILL[f]);
    else if (f && DARKEN[f]) e.setAttribute('fill', DARKEN[f]);
    else if (f && f.startsWith('rgba(255,255,255')) e.setAttribute('fill', '#444');
    if (s && LIGHT_STROKE[s]) e.setAttribute('stroke', LIGHT_STROKE[s]);
    else if (s && DARKEN[s]) e.setAttribute('stroke', DARKEN[s]);
    if (e.getAttribute('stroke') === 'rgba(26,30,61,.92)') e.setAttribute('stroke', '#555');
    if (e.tagName === 'text') {
      const cls = e.getAttribute('class') || '';
      if (!e.getAttribute('fill')) e.setAttribute('fill',
        cls.includes('wheel-angle') ? '#b8860b' : cls.includes('wheel-retro') ? '#c0392b'
        : cls.includes('wheel-sign') ? '#3a3a52' : cls.includes('wheel-planet-glyph') ? '#222' : '#777');
    }
  }
  const xml = new XMLSerializer().serializeToString(clone);
  return renderPng(xml, 1600);
}

// Аспектная сетка -> светлый SVG -> PNG (порядок точек как в app.js GRID_POINTS)
const GRID_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'Lilith', 'Selena', 'NorthNode', 'SouthNode', 'ParsFortuna', 'Vertex', 'ASC', 'MC'];
async function gridPngLight(c) {
  const fontCss = await ensureGlyphFont();
  const CELL = 34, n = GRID_ORDER.length, W = CELL * n;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const dark = col => DARKEN[col] || col;
  const retroOf = id => c.pts.find(p => p.id === id)?.retro;
  const map = new Map();
  for (const a of c.aspects) map.set(`${a.a}|${a.b}`, a);
  const aspColor = a => a.aspect.id === 'conjunction' ? '#b8860b' : a.aspect.id === 'quincunx' ? '#0f766e' : a.aspect.nature > 0 ? '#1a8f4d' : '#c0392b';
  const FONT = `font-family="DejaVu Sans, sans-serif"`;
  let s = `<style>${fontCss}</style>`;
  const label = (id, x, y) => {
    const col = dark(PLANETS[id].color), gl = PLANETS[id].glyph;
    const r = retroOf(id) ? `<text x="${x + 13}" y="${y - 6}" font-size="11" fill="#c0392b" font-weight="bold" ${FONT}>R</text>` : '';
    return `<text x="${x}" y="${y}" font-size="${gl.length > 2 ? 11 : 18}" fill="${col}" text-anchor="middle" ${FONT}>${esc(gl)}</text>${r}`;
  };
  for (let j = 0; j < n - 1; j++) s += label(GRID_ORDER[j], (j + 1) * CELL + CELL / 2, CELL / 2 + 7);
  for (let i = 1; i < n; i++) {
    s += label(GRID_ORDER[i], CELL / 2, i * CELL + CELL / 2 + 7);
    for (let j = 0; j < i; j++) {
      const a = map.get(`${GRID_ORDER[j]}|${GRID_ORDER[i]}`) || map.get(`${GRID_ORDER[i]}|${GRID_ORDER[j]}`);
      const x = (j + 1) * CELL, y = i * CELL;
      s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(0,0,0,0.16)" stroke-width="1"/>`;
      if (a) s += `<text x="${x + CELL / 2}" y="${y + CELL / 2 + 6}" font-size="16" fill="${aspColor(a)}" text-anchor="middle" ${FONT}>${a.aspect.glyph}</text>`;
    }
  }
  for (let i = 0; i < n; i++) {
    s += `<rect x="0" y="${i * CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(0,0,0,0.16)"/>`;
    s += `<rect x="${i * CELL}" y="0" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(0,0,0,0.16)"/>`;
  }
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${s}</svg>`;
  return renderPng(xml, 1292);
}

/* ---- декор в стиле матрицы ---- */
// солнце-орнамент: круг с точкой и лучами
const SUN_SVG = (size = 46) => {
  const c = size / 2, r1 = size * 0.16, r2 = size * 0.30, r3 = size * 0.44;
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    rays += `<line x1="${c + r2 * Math.cos(a)}" y1="${c + r2 * Math.sin(a)}" x2="${c + r3 * Math.cos(a)}" y2="${c + r3 * Math.sin(a)}" stroke="#000" stroke-width="1"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
    + `<circle cx="${c}" cy="${c}" r="${r1}" fill="none" stroke="#000" stroke-width="1.2"/>`
    + `<circle cx="${c}" cy="${c}" r="${size * 0.045}" fill="#000"/>${rays}</svg>`;
};
const RULE_SVG = (w = 120, h = 9) => {
  const mid = w / 2, y = h / 2, d = 3.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<line x1="0" y1="${y}" x2="${mid - 9}" y2="${y}" stroke="#888" stroke-width="0.6"/>`
    + `<line x1="${mid + 9}" y1="${y}" x2="${w}" y2="${y}" stroke="#888" stroke-width="0.6"/>`
    + `<polyline points="${mid},${y - d} ${mid + d},${y} ${mid},${y + d} ${mid - d},${y} ${mid},${y - d}" fill="none" stroke="#000" stroke-width="0.8"/>`
    + `<circle cx="${mid}" cy="${y}" r="1" fill="#000"/></svg>`;
};
function pdfPageFrame() {
  const W = 595.28, H = 841.89, m = 26, m2 = 30.5;
  const lozenge = (cx, cy, s2) => ({
    type: 'polyline',
    points: [{ x: cx, y: cy - s2 }, { x: cx + s2, y: cy }, { x: cx, y: cy + s2 }, { x: cx - s2, y: cy }],
    closePath: true, lineWidth: 0.8, lineColor: '#000',
  });
  return {
    canvas: [
      { type: 'rect', x: m, y: m, w: W - 2 * m, h: H - 2 * m, lineWidth: 0.9, lineColor: '#000' },
      { type: 'rect', x: m2, y: m2, w: W - 2 * m2, h: H - 2 * m2, lineWidth: 0.35, lineColor: '#555' },
      lozenge(m, m, 4), lozenge(W - m, m, 4), lozenge(m, H - m, 4), lozenge(W - m, H - m, 4),
      lozenge(W / 2, m, 3), lozenge(W / 2, H - m, 3), lozenge(m, H / 2, 3), lozenge(W - m, H / 2, 3),
    ],
  };
}
const TABLE_LAYOUT = {
  hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? 0.9 : 0.4),
  vLineWidth: () => 0,
  hLineColor: (i, node) => (i === 0 || i === 1 || i === node.table.body.length ? '#000' : '#bbb'),
  paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 3, paddingRight: () => 3,
};

const GOOD = '#1a8f4d', BAD = '#c0392b', GOLD = '#b8860b';

export async function downloadPdf(c, cityName, svg) {
  await ensurePdfMake();
  await ensureSerif();
  let wheelPng = null, gridPng = null;
  try { wheelPng = await wheelPngLight(svg); } catch { /* без картинки */ }
  try { gridPng = await gridPngLight(c); } catch { /* без сетки */ }

  const f = c.form;
  const pts = id => c.pts.find(p => p.id === id);
  const fmt = lon => fmtDeg(lon).text;
  const degOnly = lon => `${Math.floor(lon % 30)}°${String(Math.round((lon % 30 % 1) * 60)).padStart(2, '0')}′`;
  const P = id => PLANETS[id].name;
  const sgn = lon => SIGNS[Math.floor(lon / 30)];
  const dateLine = `${String(f.d).padStart(2, '0')}.${String(f.m).padStart(2, '0')}.${f.y}, ${String(f.hh).padStart(2, '0')}:${String(f.mm).padStart(2, '0')} (UTC${f.utc >= 0 ? '+' : ''}${f.utc}) · ${cityName}`;

  // заголовок раздела + разделитель, приклеенный к первому блоку (без «сирот»)
  const sec = (title, nodes) => {
    const head = [{ text: title.toUpperCase(), style: 'h2' }, { svg: RULE_SVG(90, 8), margin: [0, 0, 0, 7] }];
    if (nodes.length && nodes[0].text && typeof nodes[0].text === 'string' && !nodes[0].table) {
      return [{ stack: [...head, nodes[0]], unbreakable: true }, ...nodes.slice(1)];
    }
    return [{ stack: head, unbreakable: true }, ...nodes];
  };
  const par = (t, opt = {}) => ({ text: t, style: 'par', ...opt });
  const li = t => ({ text: t, style: 'par', margin: [10, 0, 0, 3] });
  const cardTitle = (t, sub) => ({
    stack: [{ text: t, style: 'cardTitle' }, ...(sub ? [{ text: sub, style: 'cardSub' }] : [])],
    margin: [0, 10, 0, 4], keepWithNext: true,
  });
  const th = (t, align) => ({ text: t, style: 'th', ...(align ? { alignment: align } : {}) });
  const td = (t, opt = {}) => ({ text: String(t), fontSize: 9, ...opt });

  const content = [];

  /* ---- обложка ---- */
  content.push({ svg: SUN_SVG(46), alignment: 'center', margin: [0, 26, 0, 12] });
  content.push({ text: 'Н А Т А Л Ь Н А Я   К А Р Т А', style: 'coverTitle', alignment: 'center' });
  content.push({ svg: RULE_SVG(170, 10), alignment: 'center', margin: [0, 12, 0, 12] });
  if (f.name) content.push({ text: f.name, style: 'coverName', alignment: 'center', margin: [0, 0, 0, 4] });
  content.push({ text: dateLine, style: 'coverSub', alignment: 'center' });
  content.push({ text: `${f.lat.toFixed(2)}, ${f.lon.toFixed(2)} · дома: Плацидус`, style: 'coverSub', alignment: 'center', margin: [0, 2, 0, 18] });
  if (wheelPng) content.push({ image: wheelPng, width: 400, alignment: 'center' });
  content.push({ text: 'Соединение 0° · секстиль 60° · квадрат 90° · тригон 120° · квинконс 150° · оппозиция 180°', style: 'legend', alignment: 'center', margin: [0, 12, 0, 0], pageBreak: 'after' });

  /* ---- вывод ---- */
  const sum = [];
  for (const b of buildSummary(c)) {
    sum.push({ text: b.head, style: 'h3', keepWithNext: true });
    for (const p of b.paras) sum.push(par(p));
  }
  content.push(...sec('Обобщённый вывод', sum));

  /* ---- таблица планет ---- */
  const pRows = [[th('Точка'), th('Знак'), th('Градус'), th('Дом'), th('R', 'center'), th('Сила', 'center'), th('Гарм.', 'center')]];
  for (const id of [...MAIN_PLANETS, 'Chiron', 'NorthNode', 'SouthNode', 'Selena', 'Lilith', 'ParsFortuna', 'Vertex']) {
    const p = pts(id); if (!p) continue;
    const s = c.strength[id];
    pRows.push([
      td(P(id) + (p.approx ? ' ≈' : ''), { bold: MAIN_PLANETS.includes(id) }),
      td(sgn(p.lon).name), td(degOnly(p.lon)), td(p.house || '—'),
      td(p.retro ? 'R' : '', { alignment: 'center', color: BAD }),
      td(s ? s.force : '—', { alignment: 'center' }),
      td(s ? s.harmony : '—', { alignment: 'center', color: s ? (s.harmony >= 0 ? GOOD : BAD) : '#111' }),
    ]);
  }
  content.push(...sec('Планеты: положения', [
    { table: { headerRows: 1, widths: ['*', 'auto', 'auto', 30, 20, 34, 36], body: pRows }, layout: TABLE_LAYOUT },
  ]));

  /* ---- дома ---- */
  const hRows = [[th('Дом'), th('Куспид'), th('Знак')]];
  c.h.cusps.slice(1).forEach((cu, i) => hRows.push([
    td(`${i + 1}${i === 0 ? ' (ASC)' : i === 9 ? ' (MC)' : ''}`), td(fmt(cu)), td(sgn(cu).name),
  ]));
  content.push(...sec('Дома (Плацидус)', [
    { table: { headerRows: 1, widths: ['auto', '*', 'auto'], body: hRows }, layout: TABLE_LAYOUT },
  ]));

  /* ---- асцендент и MC ---- */
  content.push(...sec('Асцендент и Середина неба', [
    { stack: [{ text: `Асцендент — ${fmt(c.h.asc)}`, style: 'cardTitle' }, par(ASC_TEXTS[Math.floor(c.h.asc / 30)])], unbreakable: true },
    { stack: [{ text: `Середина неба (MC) — ${fmt(c.h.mc)}`, style: 'cardTitle' }, par(MC_TEXTS[Math.floor(c.h.mc / 30)])], unbreakable: true },
  ]));

  /* ---- планеты подробно ---- */
  const det = [par('Положение каждой планеты в знаке и доме, её аспекты и интерпретация.', 'hint')];
  for (const id of [...MAIN_PLANETS, 'Chiron']) {
    const p = pts(id); if (!p) continue;
    const sIdx = Math.floor(p.lon / 30);
    const s = c.strength[id];
    const block = [];
    if (PLANET_ABOUT[id]) block.push(par(PLANET_ABOUT[id], { style: 'hint' }));
    if (PLANET_IN_SIGN[id]?.[sIdx]) block.push(par('В знаке: ' + PLANET_IN_SIGN[id][sIdx]));
    const ih = PLANET_IN_HOUSE[id]?.[p.house - 1];
    if (ih) {
      block.push(par('В доме: ' + ih.t));
      block.push(li('Достоинство: ' + ih.p));
      block.push(li('Недостаток: ' + ih.m));
    }
    if (p.retro && RETRO_TEXT[id]) block.push(par(RETRO_TEXT[id]));
    const own = c.aspects.filter(a => a.a === id || a.b === id);
    for (const a of own) {
      const other = a.a === id ? a.b : a.a;
      const pt = pairText(id, other);
      block.push({
        text: `${a.aspect.name} с ${P(other)} (орб ${a.orb}°). ${ASPECT_NATURE[a.aspect.id].text}${pt ? ' ' + pt : ''}`,
        fontSize: 9.5, margin: [10, 0, 0, 3],
        color: a.aspect.nature < 0 ? BAD : a.aspect.nature > 0 ? GOOD : '#333',
      });
    }
    det.push({
      stack: [
        cardTitle(`${P(id)} — ${sgn(p.lon).name} ${degOnly(p.lon)}, ${p.house}-й дом${p.retro ? ', ретроградная' : ''}`,
          s ? `сила ${s.force} · гармония ${s.harmony} · ${s.dignity.label}` : ''),
        block[0],
      ].filter(Boolean),
      unbreakable: true,
    });
    det.push(...block.slice(1));
  }
  content.push(...sec('Планеты: интерпретация', det));

  /* ---- аспектная сетка и список ---- */
  const asp = [];
  if (gridPng) asp.push({ image: gridPng, width: 420, alignment: 'center', margin: [0, 2, 0, 6] });
  asp.push(par('Золотые — соединения, зелёные и бирюзовые — гармоничные аспекты, красные — напряжённые. Орбы: до 8° для Солнца и Луны, 6–7° для планет, 2–3° для фиктивных точек.', 'hint'));
  const aRows = [[th('Планета'), th('Аспект'), th('Планета'), th('Орб', 'center')]];
  for (const a of c.aspects) aRows.push([
    td(P(a.a)), td(a.aspect.name, { color: a.aspect.nature < 0 ? BAD : a.aspect.nature > 0 ? GOOD : GOLD }),
    td(P(a.b)), td(a.orb + '°', { alignment: 'center' }),
  ]);
  asp.push({ table: { headerRows: 1, widths: ['*', 'auto', '*', 40], body: aRows }, layout: TABLE_LAYOUT });
  content.push(...sec('Аспектная сетка', asp));

  /* ---- конфигурации ---- */
  if (c.configs.length) {
    const conf = [];
    for (const cf of c.configs) {
      conf.push({
        stack: [
          { text: `${cf.type}: ${cf.planets.map(p => P(p)).join(' — ')}`, style: 'cardTitle' },
          par(CONFIG_TEXTS[cf.type] || ''),
        ],
        unbreakable: true,
      });
    }
    content.push(...sec('Конфигурации аспектов', conf));
  }

  /* ---- карма ---- */
  const nn = pts('NorthNode'), sn = pts('SouthNode'), sel = pts('Selena'), lil = pts('Lilith'), pf = pts('ParsFortuna'), vtx = pts('Vertex');
  const kar = [par(KARMIC_INTRO)];
  const axis = NODE_AXIS[`${Math.floor(nn.lon / 30)}-${Math.floor(sn.lon / 30)}`];
  kar.push({
    stack: [cardTitle(`Лунные узлы: Северный — ${fmt(nn.lon)} (${nn.house}-й дом), Южный — ${fmt(sn.lon)} (${sn.house}-й дом)`), par(axis || '')],
    unbreakable: true,
  });
  kar.push({ stack: [cardTitle(`Селена (Белая Луна) — ${fmt(sel.lon)}, ${sel.house}-й дом`), par(SELENA_IN_SIGN[Math.floor(sel.lon / 30)])], unbreakable: true });
  kar.push({ stack: [cardTitle(`Лилит (Чёрная Луна) — ${fmt(lil.lon)}, ${lil.house}-й дом`), par(LILITH_IN_SIGN[Math.floor(lil.lon / 30)])], unbreakable: true });
  kar.push({ stack: [cardTitle(`Парс Фортуны — ${fmt(pf.lon)}, ${pf.house}-й дом`), par(PARS_IN_HOUSE[pf.house - 1])], unbreakable: true });
  kar.push({ stack: [cardTitle(`Вертекс — ${fmt(vtx.lon)}, ${vtx.house}-й дом`), par(VERTEX_TEXT)], unbreakable: true });
  const retros = c.pts.filter(p => p.retro && RETRO_TEXT[p.id]);
  if (retros.length) {
    kar.push({ text: 'РЕТРОГРАДНЫЕ ПЛАНЕТЫ', style: 'lab' });
    for (const p of retros) kar.push(par(`${P(p.id)} R: ${RETRO_TEXT[p.id]}`));
  }
  content.push(...sec('Кармические показатели', kar));

  /* ---- астродины ---- */
  const dRows = [[th('Планета'), th('Сила', 'center'), th('Гармония', 'center'), th('Достоинство')]];
  for (const id of MAIN_PLANETS) {
    const s = c.strength[id];
    dRows.push([
      td(P(id)), td(s.force, { alignment: 'center' }),
      td(s.harmony, { alignment: 'center', color: s.harmony >= 0 ? GOOD : BAD }), td(s.dignity.label),
    ]);
  }
  content.push(...sec('Сила и гармония планет (астродины)', [
    { table: { headerRows: 1, widths: ['*', 44, 56, '*'], body: dRows }, layout: TABLE_LAYOUT },
    par('Упрощённая модель: сила = достоинство + дом + аспектная связанность; гармония = достоинство + баланс гармоничных и напряжённых аспектов.', 'hint'),
  ]));

  /* ---- задняя страница ---- */
  content.push({ svg: SUN_SVG(40), alignment: 'center', margin: [0, 90, 0, 14], pageBreak: 'before' });
  content.push({ text: 'Н А Т А Л Ь Н А Я   К А Р Т А', style: 'backTitle', alignment: 'center' });
  content.push({ text: 'бесплатный расчёт онлайн', style: 'backSub', alignment: 'center', margin: [0, 4, 0, 0] });
  content.push({ svg: RULE_SVG(150, 9), alignment: 'center', margin: [0, 16, 0, 16] });
  content.push({ text: 'Понравился разбор? Рассчитайте карту себе, партнёру или ребёнку — это бесплатно и без регистрации:', style: 'backText', alignment: 'center', margin: [70, 0, 70, 14] });
  content.push({ text: SITE_URL, link: SITE_URL, style: 'backLink', alignment: 'center' });
  content.push({ text: 'Расчёт выполнен в браузере на основе Astronomy Engine (MIT). Хирон, Селена и Лилит — приближённые (≈). Материалы носят ознакомительный характер.', style: 'backNote', alignment: 'center', margin: [40, 18, 40, 0] });

  const fname = `natal-${(f.name || 'karta').replace(/[^\wа-яё-]+/gi, '_')}-${f.y}${String(f.m).padStart(2, '0')}${String(f.d).padStart(2, '0')}.pdf`;
  window.pdfMake.createPdf({
    pageSize: 'A4',
    pageMargins: [56, 64, 56, 58],
    background: () => pdfPageFrame(),
    header: cur => (cur > 1 ? {
      stack: [
        { columns: [{ text: 'НАТАЛЬНАЯ КАРТА', style: 'headL' }, { text: dateLine, style: 'headR', alignment: 'right' }] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 0.5, lineColor: '#999' }], margin: [0, 4, 0, 0] },
      ],
      margin: [56, 40, 56, 0],
    } : null),
    footer: (cur, total) => ({
      columns: [
        { text: '•  Натальная карта · бесплатный расчёт онлайн  •', style: 'foot', alignment: 'right', width: '*', margin: [0, 0, 8, 0] },
        { text: `${cur} / ${total}`, style: 'foot', width: 'auto' },
      ],
      margin: [56, 6, 56, 0],
    }),
    info: { title: `Натальная карта — ${dateLine}`, author: 'Натальная карта · бесплатный расчёт онлайн' },
    defaultStyle: { fontSize: 10, lineHeight: 1.45, color: '#111' },
    content,
    styles: {
      coverTitle: { font: 'Serif', fontSize: 21, bold: true, characterSpacing: 4, color: '#000' },
      coverName: { font: 'Serif', fontSize: 14, bold: true, color: '#000' },
      coverSub: { fontSize: 10.5, characterSpacing: 0.6, color: '#333' },
      legend: { fontSize: 8, color: '#555', characterSpacing: 0.5 },
      h2: { font: 'Serif', fontSize: 15, bold: true, characterSpacing: 2, color: '#000', margin: [0, 14, 0, 6] },
      h3: { fontSize: 11.5, bold: true, color: '#000', margin: [0, 10, 0, 4] },
      th: { fontSize: 8.5, bold: true, characterSpacing: 1, color: '#444' },
      par: { margin: [0, 0, 0, 5] },
      hint: { fontSize: 9, color: '#444', italics: true, margin: [0, 2, 0, 8] },
      lab: { fontSize: 8, bold: true, characterSpacing: 2, color: '#555', margin: [0, 8, 0, 3] },
      cardTitle: { fontSize: 11.5, bold: true, color: '#000' },
      cardSub: { fontSize: 8.5, color: '#555', characterSpacing: 0.6, margin: [0, 2, 0, 0] },
      backTitle: { font: 'Serif', fontSize: 17, bold: true, characterSpacing: 4, color: '#000' },
      backSub: { fontSize: 10, characterSpacing: 1, color: '#444' },
      backText: { fontSize: 10.5, lineHeight: 1.5, color: '#222' },
      backLink: { fontSize: 12, bold: true, color: '#000' },
      backNote: { fontSize: 8.5, italics: true, color: '#666' },
      headL: { fontSize: 8, bold: true, characterSpacing: 2, color: '#555' },
      headR: { fontSize: 8, characterSpacing: 0.5, color: '#777' },
      foot: { fontSize: 7.5, characterSpacing: 2, color: '#555' },
    },
  }).download(fname);
}
