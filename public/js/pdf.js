// Выгрузка полного отчёта в PDF (pdfmake, ленивая загрузка с CDN).
import { SIGNS, PLANETS, fmtDeg, ELEMENT_NAMES, CROSS_NAMES } from './astro/format.js';
import { PLANET_IN_SIGN, RETRO_TEXT } from './data/texts_planet_sign.js';
import { PLANET_IN_HOUSE } from './data/texts_planet_house.js';
import { ASC_TEXTS, MC_TEXTS, NODE_AXIS, LILITH_IN_SIGN, SELENA_IN_SIGN, PARS_IN_HOUSE, VERTEX_TEXT, CONFIG_TEXTS, ASPECT_NATURE } from './data/texts_angles.js';
import { pairText, PLANET_ABOUT, KARMIC_INTRO } from './data/texts_pairs.js';
import { buildSummary, MAIN_PLANETS } from './summary.js';

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

// SVG колеса -> PNG dataURL (стили вшиваем внутрь клона)
function svgToPng(svg) {
  const STYLE = 'text{font-family:"Segoe UI",sans-serif;fill:#eceefb}.wheel-sign{font-size:22px}.wheel-house-num{fill:#9aa0c3;font-size:13px}.wheel-cusp-deg{fill:#9aa0c3;font-size:10.5px}.wheel-angle{fill:#ffd166;font-size:15px;font-weight:700}.wheel-planet-glyph{font-size:19px}.wheel-retro{fill:#ff6b6b;font-size:10px;font-weight:700}';
  return new Promise((res, rej) => {
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', 760); clone.setAttribute('height', 760);
    const st = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    st.textContent = STYLE;
    clone.insertBefore(st, clone.firstChild);
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', 760); bg.setAttribute('height', 760); bg.setAttribute('fill', '#0a0c16');
    clone.insertBefore(bg, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    renderPng(xml, 1520).then(res, rej);
  });
}

function renderPng(xml, px) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = px; cv.height = px;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#0a0c16'; ctx.fillRect(0, 0, px, px);
      ctx.drawImage(img, 0, 0, px, px);
      res(cv.toDataURL('image/png'));
    };
    img.onerror = () => rej(new Error('svg render'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}

// Аспектная сетка -> SVG-строка (порядок точек как в app.js GRID_POINTS)
const GRID_ORDER = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto',
  'Chiron', 'Lilith', 'Selena', 'NorthNode', 'SouthNode', 'ParsFortuna', 'Vertex', 'ASC', 'MC'];
function gridSvg(c) {
  const CELL = 34, n = GRID_ORDER.length, W = CELL * n;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const lonOf = id => id === 'ASC' ? c.h.asc : id === 'MC' ? c.h.mc : c.pts.find(p => p.id === id)?.lon;
  const retroOf = id => c.pts.find(p => p.id === id)?.retro;
  const map = new Map();
  for (const a of c.aspects) map.set(`${a.a}|${a.b}`, a);
  const aspColor = a => a.aspect.id === 'conjunction' ? '#ffd166' : a.aspect.id === 'quincunx' ? '#4fd1c5' : a.aspect.nature > 0 ? '#5ce8a0' : '#ff6b6b';
  let s = `<rect width="${W}" height="${W}" fill="#0a0c16"/>`;
  const label = (id, x, y) => {
    const col = PLANETS[id].color, gl = PLANETS[id].glyph;
    const r = retroOf(id) ? `<text x="${x + 13}" y="${y - 6}" font-size="11" fill="#ff6b6b" font-weight="bold">R</text>` : '';
    return `<text x="${x}" y="${y}" font-size="${gl.length > 2 ? 11 : 18}" fill="${col}" text-anchor="middle" font-family="Segoe UI, sans-serif">${esc(gl)}</text>${r}`;
  };
  for (let j = 0; j < n - 1; j++) s += label(GRID_ORDER[j], (j + 1) * CELL + CELL / 2, CELL / 2 + 7);
  for (let i = 1; i < n; i++) {
    s += label(GRID_ORDER[i], CELL / 2, i * CELL + CELL / 2 + 7);
    for (let j = 0; j < i; j++) {
      const a = map.get(`${GRID_ORDER[j]}|${GRID_ORDER[i]}`) || map.get(`${GRID_ORDER[i]}|${GRID_ORDER[j]}`);
      const x = (j + 1) * CELL, y = i * CELL;
      s += `<rect x="${x}" y="${y}" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>`;
      if (a) s += `<text x="${x + CELL / 2}" y="${y + CELL / 2 + 7}" font-size="17" fill="${aspColor(a)}" text-anchor="middle" font-family="Segoe UI, sans-serif">${a.aspect.glyph}</text>`;
    }
  }
  // внешняя рамка и левая/верхняя границы
  for (let i = 0; i < n; i++) {
    s += `<rect x="0" y="${i * CELL}" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(255,255,255,0.12)"/>`;
    s += `<rect x="${i * CELL}" y="0" width="${CELL}" height="${CELL}" fill="none" stroke="rgba(255,255,255,0.12)"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">${s}</svg>`;
}

const GOLD = '#b8860b', DIM = '#555555', VIOLET = '#5a4fcf', GOOD = '#1a8f4d', BAD = '#c0392b';

export async function downloadPdf(c, cityName, svg) {
  await ensurePdfMake();
  let wheelPng = null, gridPng = null;
  try { wheelPng = await svgToPng(svg); } catch { /* без картинки */ }
  try { gridPng = await renderPng(gridSvg(c), 1292); } catch { /* без сетки */ }

  const f = c.form;
  const pts = id => c.pts.find(p => p.id === id);
  const fmt = lon => { const t = fmtDeg(lon); return `${t.text}`; };
  const degOnly = lon => `${Math.floor(lon % 30)}°${String(Math.round((lon % 30 % 1) * 60)).padStart(2, '0')}′`;
  const P = id => PLANETS[id].name;
  const sgn = lon => SIGNS[Math.floor(lon / 30)];

  const content = [];
  const H = t => ({ text: t, fontSize: 15, bold: true, color: VIOLET, margin: [0, 14, 0, 6] });
  const P0 = (t, opt = {}) => ({ text: t, fontSize: 10.5, margin: [0, 0, 0, 5], ...opt });
  const LI = t => ({ text: t, fontSize: 10.5, margin: [8, 0, 0, 3] });

  content.push({ text: 'НАТАЛЬНАЯ КАРТА', fontSize: 22, bold: true, color: GOLD, alignment: 'center' });
  if (f.name) content.push({ text: f.name, fontSize: 15, bold: true, alignment: 'center', margin: [0, 4, 0, 0] });
  content.push({
    text: `${String(f.d).padStart(2, '0')}.${String(f.m).padStart(2, '0')}.${f.y}, ${String(f.hh).padStart(2, '0')}:${String(f.mm).padStart(2, '0')} (UTC${f.utc >= 0 ? '+' : ''}${f.utc}) · ${cityName} · ${f.lat.toFixed(2)}, ${f.lon.toFixed(2)} · дома: Плацидус`,
    fontSize: 10, color: DIM, alignment: 'center', margin: [0, 4, 0, 8],
  });
  if (wheelPng) content.push({ image: wheelPng, width: 430, alignment: 'center', margin: [0, 6, 0, 6] });

  // Вывод
  content.push(H('Обобщённый вывод'));
  for (const b of buildSummary(c)) {
    content.push({ text: b.head, fontSize: 12, bold: true, margin: [0, 6, 0, 3] });
    for (const p of b.paras) content.push(P0(p));
  }

  // Планеты — таблица
  content.push(H('Планеты: положения'));
  const pRows = [['Планета', 'Знак', 'Градус', 'Дом', 'R', 'Сила', 'Гармония'].map(x => ({ text: x, bold: true, fontSize: 9.5 }))];
  for (const id of [...MAIN_PLANETS, 'Chiron', 'NorthNode', 'SouthNode', 'Selena', 'Lilith', 'ParsFortuna', 'Vertex']) {
    const p = pts(id); if (!p) continue;
    const s = c.strength[id];
    pRows.push([
      P(id) + (p.approx ? ' ≈' : ''), sgn(p.lon).name, degOnly(p.lon), String(p.house || '—'),
      p.retro ? 'R' : '', s ? String(s.force) : '—',
      s ? { text: String(s.harmony), color: s.harmony >= 0 ? GOOD : BAD } : '—',
    ].map(x => (typeof x === 'object' ? { fontSize: 9.5, ...x } : { text: x, fontSize: 9.5 })));
  }
  content.push({ table: { headerRows: 1, widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'], body: pRows }, layout: 'lightHorizontalLines', margin: [0, 0, 0, 6] });

  // Дома
  content.push(H('Дома (Плацидус)'));
  const hRows = [['Дом', 'Куспид', 'Знак'].map(x => ({ text: x, bold: true, fontSize: 9.5 }))];
  c.h.cusps.slice(1).forEach((cu, i) => hRows.push([
    { text: `${i + 1}${i === 0 ? ' (ASC)' : i === 9 ? ' (MC)' : ''}`, fontSize: 9.5 },
    { text: fmt(cu), fontSize: 9.5 }, { text: sgn(cu).name, fontSize: 9.5 },
  ]));
  content.push({ table: { headerRows: 1, widths: ['auto', '*', 'auto'], body: hRows }, layout: 'lightHorizontalLines' });

  // Асцендент и MC
  content.push(H('Асцендент и Середина неба'));
  content.push(P0(`Асцендент — ${fmt(c.h.asc)}. ${ASC_TEXTS[Math.floor(c.h.asc / 30)]}`));
  content.push(P0(`Середина неба (MC) — ${fmt(c.h.mc)}. ${MC_TEXTS[Math.floor(c.h.mc / 30)]}`));

  // Планеты подробно
  content.push(H('Планеты: интерпретация'));
  for (const id of [...MAIN_PLANETS, 'Chiron']) {
    const p = pts(id); if (!p) continue;
    const sIdx = Math.floor(p.lon / 30);
    const s = c.strength[id];
    content.push({
      text: `${P(id)} — ${sgn(p.lon).name} ${degOnly(p.lon)}, ${p.house}-й дом${p.retro ? ', ретроградная' : ''}${s ? ` · сила ${s.force} · гармония ${s.harmony}` : ''}`,
      fontSize: 12, bold: true, margin: [0, 8, 0, 3],
    });
    if (PLANET_ABOUT[id]) content.push(P0(PLANET_ABOUT[id], { italics: true, color: DIM }));
    if (PLANET_IN_SIGN[id]?.[sIdx]) content.push(P0(`В знаке: ${PLANET_IN_SIGN[id][sIdx]}`));
    const ih = PLANET_IN_HOUSE[id]?.[p.house - 1];
    if (ih) {
      content.push(P0(`В доме: ${ih.t}`));
      content.push(LI(`Достоинство: ${ih.p}`));
      content.push(LI(`Недостаток: ${ih.m}`));
    }
    if (p.retro && RETRO_TEXT[id]) content.push(P0(RETRO_TEXT[id]));
    const own = c.aspects.filter(a => a.a === id || a.b === id);
    if (own.length) {
      content.push({ text: 'Аспекты:', bold: true, fontSize: 10.5, margin: [0, 3, 0, 2] });
      for (const a of own) {
        const other = a.a === id ? a.b : a.a;
        const pt = pairText(id, other);
        content.push({
          text: `${a.aspect.name} с ${P(other)} (орб ${a.orb}°). ${ASPECT_NATURE[a.aspect.id].text}${pt ? ' ' + pt : ''}`,
          fontSize: 10, margin: [8, 0, 0, 3], color: a.aspect.nature < 0 ? BAD : a.aspect.nature > 0 ? GOOD : '#333',
        });
      }
    }
  }

  // Все аспекты
  content.push(H('Аспектная сетка'));
  if (gridPng) content.push({ image: gridPng, width: 430, alignment: 'center', margin: [0, 4, 0, 4] });
  content.push(P0('Соединение 0° · тригон 120° · секстиль 60° · квинконс 150° · квадрат 90° · оппозиция 180°. Золотые — соединения, зелёные и бирюзовые — гармоничные, красные — напряжённые. Орбы: до 8° для Солнца и Луны, 6–7° для планет, 2–3° для фиктивных точек.', { color: DIM, fontSize: 9 }));
  content.push(H('Все аспекты'));
  const aRows = [['Планета', 'Аспект', 'Планета', 'Орб'].map(x => ({ text: x, bold: true, fontSize: 9.5 }))];
  for (const a of c.aspects) aRows.push([
    { text: P(a.a), fontSize: 9.5 },
    { text: a.aspect.name, fontSize: 9.5, color: a.aspect.nature < 0 ? BAD : a.aspect.nature > 0 ? GOOD : GOLD },
    { text: P(a.b), fontSize: 9.5 }, { text: a.orb + '°', fontSize: 9.5 },
  ]);
  content.push({ table: { headerRows: 1, widths: ['*', 'auto', '*', 'auto'], body: aRows }, layout: 'lightHorizontalLines' });

  // Конфигурации
  if (c.configs.length) {
    content.push(H('Конфигурации аспектов'));
    for (const cf of c.configs) {
      content.push({ text: `${cf.type}: ${cf.planets.map(p => P(p)).join(' — ')}`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
      content.push(P0(CONFIG_TEXTS[cf.type] || ''));
    }
  }

  // Карма
  content.push(H('Кармические показатели'));
  content.push(P0(KARMIC_INTRO));
  const nn = pts('NorthNode'), sn = pts('SouthNode'), sel = pts('Selena'), lil = pts('Lilith'), pf = pts('ParsFortuna'), vtx = pts('Vertex');
  const axis = NODE_AXIS[`${Math.floor(nn.lon / 30)}-${Math.floor(sn.lon / 30)}`];
  content.push({ text: `Лунные узлы: Северный — ${fmt(nn.lon)} (${nn.house}-й дом), Южный — ${fmt(sn.lon)} (${sn.house}-й дом)`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
  if (axis) content.push(P0(axis));
  content.push({ text: `Селена (Белая Луна) — ${fmt(sel.lon)}, ${sel.house}-й дом`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
  content.push(P0(SELENA_IN_SIGN[Math.floor(sel.lon / 30)]));
  content.push({ text: `Лилит (Чёрная Луна) — ${fmt(lil.lon)}, ${lil.house}-й дом`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
  content.push(P0(LILITH_IN_SIGN[Math.floor(lil.lon / 30)]));
  content.push({ text: `Парс Фортуны — ${fmt(pf.lon)}, ${pf.house}-й дом`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
  content.push(P0(PARS_IN_HOUSE[pf.house - 1]));
  content.push({ text: `Вертекс — ${fmt(vtx.lon)}, ${vtx.house}-й дом`, bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
  content.push(P0(VERTEX_TEXT));
  const retros = c.pts.filter(p => p.retro && RETRO_TEXT[p.id]);
  if (retros.length) {
    content.push({ text: 'Ретроградные планеты', bold: true, fontSize: 11, margin: [0, 4, 0, 2] });
    for (const p of retros) content.push(P0(`${P(p.id)} R: ${RETRO_TEXT[p.id]}`));
  }

  // Астродины
  content.push(H('Сила и гармония планет (астродины)'));
  const dRows = [['Планета', 'Сила', 'Гармония', 'Достоинство'].map(x => ({ text: x, bold: true, fontSize: 9.5 }))];
  for (const id of MAIN_PLANETS) {
    const s = c.strength[id];
    dRows.push([{ text: P(id), fontSize: 9.5 }, { text: String(s.force), fontSize: 9.5 },
      { text: String(s.harmony), fontSize: 9.5, color: s.harmony >= 0 ? GOOD : BAD }, { text: s.dignity.label, fontSize: 9.5 }]);
  }
  content.push({ table: { headerRows: 1, widths: ['*', 'auto', 'auto', '*'], body: dRows }, layout: 'lightHorizontalLines' });
  content.push(P0('Упрощённая модель: сила = достоинство + дом + аспектная связанность; гармония = достоинство + баланс гармоничных и напряжённых аспектов.', { color: DIM, fontSize: 9, margin: [0, 4, 0, 0] }));

  content.push({
    text: 'Расчёт выполнен в браузере на основе Astronomy Engine (MIT). Хирон, Селена и Лилит — приближённые (≈). Материалы носят ознакомительный характер.',
    fontSize: 8.5, color: DIM, margin: [0, 14, 0, 0],
  });

  const fname = `natal-${(f.name || 'karta').replace(/[^\wа-яё-]+/gi, '_')}-${f.y}${String(f.m).padStart(2, '0')}${String(f.d).padStart(2, '0')}.pdf`;
  window.pdfMake.createPdf({ content, pageSize: 'A4', pageMargins: [40, 44, 40, 44], info: { title: 'Натальная карта' } }).download(fname);
}
