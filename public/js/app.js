// Главный модуль приложения: форма, расчёт, рендер отчёта.
import { julianDay, computePoints, norm360 } from './astro/core.js';
import { houses, houseOf, parsFortunae } from './astro/houses.js';
import { findAspects, findConfigurations, ASPECTS } from './astro/aspects.js';
import { planetStrength, dignity } from './astro/dyn.js';
import { SIGNS, PLANETS, signOf, fmtDeg, ELEMENT_NAMES, CROSS_NAMES } from './astro/format.js';
import { PLANET_IN_SIGN, RETRO_TEXT } from './data/texts_planet_sign.js';
import { PLANET_IN_HOUSE } from './data/texts_planet_house.js';
import { ASC_TEXTS, MC_TEXTS, NODE_AXIS, LILITH_IN_SIGN, SELENA_IN_SIGN, PARS_IN_HOUSE, VERTEX_TEXT, CONFIG_TEXTS, ASPECT_NATURE } from './data/texts_angles.js';
import { pairText, PLANET_ABOUT, ELEMENT_TEXTS, CROSS_TEXTS, KARMIC_INTRO } from './data/texts_pairs.js';
import { searchLocalCities, geocodeOnline } from './geo.js';
import { dstSuggested } from './data/cities.js';
import { drawWheel } from './wheel.js?v=3';
import { buildSummary } from './summary.js?v=1';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const MAIN_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

const HOUSE_DOMAIN = [
  'личность, внешность и первое впечатление', 'деньги, собственность и самоценность',
  'общение, учёбу, братьев и сестёр, поездки', 'дом, семью, корни и завершение дел',
  'любовь, детей, творчество и удовольствия', 'работу, здоровье и повседневный режим',
  'брак, партнёрство и открытые союзы', 'кризисы, чужие ресурсы и трансформации',
  'мировоззрение, путешествия, веру и высшее образование', 'карьеру, статус и призвание',
  'друзей, надежды и планы на будущее', 'тайны, уединение, подсознание и завершение циклов',
];
const SIGN_KEY = [
  'инициатива и напор', 'основательность и чувственность', 'гибкость и контактность',
  'забота и эмоциональная глубина', 'яркость и творческий размах', 'точность и практичность',
  'дипломатия и эстетика', 'интенсивность и глубина', 'оптимизм и масштаб',
  'дисциплина и стратегия', 'оригинальность и независимость', 'чуткость и воображение',
];

let lastChart = null;

// ---------- Форма ----------
const cityInput = $('#city'), suggBox = $('#citySugg');
cityInput.addEventListener('input', () => {
  const list = searchLocalCities(cityInput.value);
  suggBox.innerHTML = '';
  if (!list.length) { suggBox.hidden = true; return; }
  for (const c of list) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sugg-item';
    b.textContent = `${c.name} (${c.lat.toFixed(2)}, ${c.lon.toFixed(2)}, UTC+${c.utc})`;
    b.onclick = () => { pickCity(c); suggBox.hidden = true; };
    suggBox.appendChild(b);
  }
  suggBox.hidden = false;
});
document.addEventListener('click', e => { if (!suggBox.contains(e.target) && e.target !== cityInput) suggBox.hidden = true; });

function pickCity(c) {
  cityInput.value = c.name;
  $('#lat').value = c.lat.toFixed(4);
  $('#lon').value = c.lon.toFixed(4);
  if (c.utc !== null && c.utc !== undefined) $('#utc').value = c.utc;
  autoDst();
}
function autoDst() {
  const d = $('#date').value;
  if (!d) return;
  const [y, m, dd] = d.split('-').map(Number);
  $('#dst').checked = dstSuggested(y, m, dd);
}
$('#date').addEventListener('change', autoDst);
$('#btnGeo').onclick = async () => {
  const q = cityInput.value.trim();
  if (q.length < 2) return toast('Введите название города');
  $('#btnGeo').disabled = true;
  try {
    const res = await geocodeOnline(q);
    if (!res.length) return toast('Город не найден');
    suggBox.innerHTML = '';
    res.forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sugg-item';
      b.textContent = `${c.name} (${c.lat.toFixed(2)}, ${c.lon.toFixed(2)})`;
      b.onclick = () => { pickCity(c); suggBox.hidden = true; toast('Проверьте UTC-сдвиг вручную'); };
      suggBox.appendChild(b);
    });
    suggBox.hidden = false;
  } catch (e) { toast('Онлайн-поиск недоступен: ' + e.message); }
  finally { $('#btnGeo').disabled = false; }
};

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- Расчёт ----------
function readForm() {
  const [y, m, d] = $('#date').value.split('-').map(Number);
  if (!y || y < 1900 || y > 2100) throw new Error('Укажите дату рождения (1900–2100)');
  const [hh, mm] = ($('#time').value || '12:00').split(':').map(Number);
  const lat = parseFloat($('#lat').value), lon = parseFloat($('#lon').value);
  if (!isFinite(lat) || !isFinite(lon)) throw new Error('Выберите город из списка или найдите онлайн');
  const utc = parseFloat($('#utc').value) + ($('#dst').checked ? 1 : 0);
  const jd = julianDay(y, m, d, hh + mm / 60 - utc);
  return { jd, lat, lon, utc, name: $('#name').value.trim(), y, m, d, hh, mm };
}

function calc(form) {
  const pts = computePoints(form.jd);
  const h = houses(form.jd, form.lat, form.lon);
  for (const p of pts) p.house = houseOf(p.lon, h.cusps);
  const sun = pts.find(p => p.id === 'Sun'), moon = pts.find(p => p.id === 'Moon');
  const pf = parsFortunae(h.asc, sun.lon, moon.lon, sun.house);
  pts.push({ id: 'ParsFortuna', lon: pf, lat: 0, retro: false, house: houseOf(pf, h.cusps) });
  pts.push({ id: 'Vertex', lon: h.vertex, lat: 0, retro: false, house: houseOf(h.vertex, h.cusps) });
  pts.push({ id: 'SouthNode', lon: norm360(pts.find(p => p.id === 'NorthNode').lon + 180), lat: 0, retro: true, house: houseOf(norm360(pts.find(p => p.id === 'NorthNode').lon + 180), h.cusps) });

  const aspectPts = [...pts, { id: 'ASC', lon: h.asc }, { id: 'MC', lon: h.mc }];
  const aspects = findAspects(aspectPts);
  const angleAspects = aspects.filter(a => a.a === 'ASC' || a.a === 'MC' || a.b === 'ASC' || a.b === 'MC');
  const configs = findConfigurations(MAIN_PLANETS, aspects);

  // сила/гармония
  const strength = {};
  for (const p of pts.filter(p => MAIN_PLANETS.includes(p.id))) {
    const own = aspects.filter(a => a.a === p.id || a.b === p.id);
    strength[p.id] = planetStrength(p, p.house, own);
  }
  return { pts, h, aspects, angleAspects, configs, strength, form };
}

// ---------- Рендер ----------
const gl = id => (PLANETS[id] || {}).glyph || '';
const nm = id => (PLANETS[id] || {}).name || id;
const degStr = lon => { const f = fmtDeg(lon); return `${f.sign.glyph} ${f.sign.prep} ${Math.floor(lon % 30)}°`; };

function render(chart) {
  lastChart = chart;
  $('#results').hidden = false;
  const f = chart.form;
  $('#chartTitle').textContent = f.name ? `${f.name} — натальная карта` : 'Натальная карта';
  $('#chartSub').textContent = `${String(f.d).padStart(2, '0')}.${String(f.m).padStart(2, '0')}.${f.y}, ${String(f.hh).padStart(2, '0')}:${String(f.mm).padStart(2, '0')} (UTC${f.utc >= 0 ? '+' : ''}${f.utc}) · ${$('#city').value} · широта ${f.lat.toFixed(2)}, долгота ${f.lon.toFixed(2)} · дома: Плацидус`;

  drawWheel($('#wheelSvg'), {
    points: chart.pts.filter(p => [...MAIN_PLANETS, 'Chiron', 'NorthNode'].includes(p.id)),
    cusps: chart.h.cusps, asc: chart.h.asc, mc: chart.h.mc,
    aspects: chart.aspects,
  });

  renderOverview(chart);
  renderSummary(chart);
  renderPlanets(chart);
  renderAngles(chart);
  renderHouses(chart);
  renderAspects(chart);
  renderKarma(chart);
  renderDyn(chart);
  renderElements(chart);
  renderSchema(chart);
  document.querySelectorAll('.chip')[0]?.click();
  $('#results').scrollIntoView({ behavior: 'smooth' });
}

function renderOverview(c) {
  const rows = c.pts.filter(p => [...MAIN_PLANETS, 'Chiron', 'NorthNode', 'SouthNode', 'Selena', 'Lilith', 'ParsFortuna', 'Vertex'].includes(p.id))
    .map(p => {
      const f = fmtDeg(p.lon);
      const s = c.strength[p.id];
      return `<tr><td><b style="color:${PLANETS[p.id].color}">${gl(p.id)}</b> ${nm(p.id)}${p.retro ? ' <span class="retro">R</span>' : ''}${p.approx ? ' ≈' : ''}</td>
        <td>${f.text}</td><td>${p.house || '—'}</td>
        ${s ? `<td>${s.force}</td><td class="${s.harmony >= 0 ? 'pos' : 'neg'}">${s.harmony}</td>` : '<td>—</td><td>—</td>'}</tr>`;
    }).join('');
  const hrows = c.h.cusps.slice(1).map((cu, i) => {
    const f = fmtDeg(cu);
    return `<tr><td>${i + 1}-й дом${i === 0 ? ' (ASC)' : i === 9 ? ' (MC)' : ''}</td><td>${f.text}</td></tr>`;
  }).join('');
  const confRows = c.configs.map(cf => `<tr><td><b>${cf.type}</b></td><td>${cf.planets.map(p => `${gl(p)} ${nm(p)}`).join(' — ')}</td></tr>`).join('') || '<tr><td colspan="2">Выраженных конфигураций нет</td></tr>';
  $('#tab-overview').innerHTML = `
    <div class="card" open><summary><div class="card-head"><span class="card-title">Планеты: положения</span><span class="card-sub">долгота, дом, ретроградность</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><table class="ntable"><thead><tr><th>Точка</th><th>Долгота</th><th>Дом</th><th>Сила</th><th>Гармония</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Дома (Плацидус)</span><span class="card-sub">куспиды 12 домов</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><table class="ntable"><thead><tr><th>Дом</th><th>Куспид</th></tr></thead><tbody>${hrows}</tbody></table></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Конфигурации аспектов</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><table class="ntable"><tbody>${confRows}</tbody></table></div></div>`;
}

function planetSection(c, id) {
  const p = c.pts.find(x => x.id === id);
  const sIdx = Math.floor(p.lon / 30), sign = SIGNS[sIdx];
  const inSign = PLANET_IN_SIGN[id]?.[sIdx] || '';
  const inHouse = PLANET_IN_HOUSE[id]?.[p.house - 1];
  const own = c.aspects.filter(a => a.a === id || a.b === id);
  const aspRows = own.map(a => {
    const other = a.a === id ? a.b : a.a;
    const pt = pairText(id, other);
    return `<div class="asp-row"><span class="asp-badge" style="color:${a.aspect.nature < 0 ? 'var(--bad)' : a.aspect.nature > 0 ? 'var(--good)' : 'var(--gold)'}">${a.aspect.glyph}</span>
      <b>${a.aspect.name}</b> с ${gl(other)} ${nm(other)} <span class="orb">(орб ${a.orb}°)</span>
      ${pt ? `<p class="asp-text">${esc(ASPECT_NATURE[a.aspect.id].text)} ${esc(pt)}</p>` : `<p class="asp-text">${esc(ASPECT_NATURE[a.aspect.id].text)}</p>`}</div>`;
  }).join('');
  const s = c.strength[id];
  return `<div class="card"><summary>
      <div class="card-head"><span class="card-title"><b style="color:${PLANETS[id].color}">${gl(id)}</b> ${nm(id)} — ${degStr(p.lon)}, ${p.house}-й дом${p.retro ? ' <span class="retro">R</span>' : ''}</span>
      <span class="card-sub">${s ? `сила ${s.force} · гармония ${s.harmony} · ${s.dignity.label}` : ''}</span></div><span class="card-chevron">▾</span></summary>
    <div class="card-body">
      <p class="about">${esc(PLANET_ABOUT[id] || '')}</p>
      <div class="blk"><span class="blk-label tip">В знаке ${sign.prep}</span><p>${esc(inSign)}</p></div>
      ${inHouse ? `<div class="blk"><span class="blk-label tip">В ${p.house}-м доме</span><p>${esc(inHouse.t)}</p>
        <p><span class="blk-label plus">Достоинство</span> ${esc(inHouse.p)}</p>
        <p><span class="blk-label minus">Недостаток</span> ${esc(inHouse.m)}</p></div>` : ''}
      ${p.retro && RETRO_TEXT[id] ? `<div class="blk"><span class="blk-label warn">Ретроградность</span><p>${esc(RETRO_TEXT[id])}</p></div>` : ''}
      ${own.length ? `<div class="blk"><span class="blk-label tip">Аспекты</span>${aspRows}</div>` : ''}
    </div></div>`;
}

function renderSummary(c) {
  const blocks = buildSummary(c);
  $('#tab-summary').innerHTML = `
    <p class="hint">Короткое резюме всей карты простым языком: кто вы, в чём сила, над чем работать и куда движется судьба. Подробности — в остальных вкладках.</p>
    ${blocks.map(b => `<div class="card" open><summary><div class="card-head"><span class="card-title">${b.head}</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body">${b.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div></div>`).join('')}`;
}

// Вкладка «Схема»: объяснение каждого элемента колеса с отдельной мини-схемой
function renderSchema(c) {
  const wheelPts = c.pts.filter(p => [...MAIN_PLANETS, 'Chiron', 'NorthNode'].includes(p.id));
  const base = { points: wheelPts, cusps: c.h.cusps, asc: c.h.asc, mc: c.h.mc };
  const sun = c.pts.find(p => p.id === 'Sun'), moon = c.pts.find(p => p.id === 'Moon');
  const sunSign = SIGNS[Math.floor(sun.lon / 30)], moonSign = SIGNS[Math.floor(moon.lon / 30)];
  const good = c.aspects.filter(a => a.aspect.nature > 0);
  const bad = c.aspects.filter(a => a.aspect.nature < 0);
  const conj = c.aspects.filter(a => a.aspect.id === 'conjunction');
  const retroPts = wheelPts.filter(p => p.retro);
  const items = [
    {
      t: 'Цветное кольцо снаружи — это 12 знаков зодиака', focus: 'signs', aspects: [],
      paras: [
        'Весь круг поделён на 12 цветных ломтиков, как торт. Каждый ломтик — один знак зодиака, его значок нарисован внутри ломтика: ♈ Овен, ♉ Телец, ♊ Близнецы и так далее по кругу.',
        'Маленькие чёрточки по краю ломтика — градусы, одна чёрточка = 5°. В каждом знаке ровно 30°.',
        `Пример из вашей карты: значок ☉ (Солнце) стоит в ломтике ${sunSign.glyph} — значит, ваше Солнце в знаке ${sunSign.prep}. А ☽ (Луна) — в ${moonSign.glyph}, Луна у вас в знаке ${moonSign.prep}.`,
      ],
    },
    {
      t: 'Лучи от центра — границы домов, цифры — их номера', focus: 'cusps', aspects: [],
      paras: [
        'От центра к кольцу идут тонкие линии-лучи. Они делят круг на 12 «комнат» — домов. Маленькая цифра внутри каждой комнаты — её номер: 1, 2, 3 … 12.',
        'Каждый дом отвечает за свою сферу жизни: 1-й — характер и внешность, 7-й — брак, 10-й — карьера и так далее.',
        'Маленькая цифра со значком ° снаружи кольца — точный градус начала дома.',
        `Как читать: найдите планету и посмотрите, между какими лучами она стоит. Ваше Солнце ☉ попало в «комнату» №${sun.house} — значит, Солнце у вас в ${sun.house}-м доме. Вся расшифровка домов — во вкладке «Дома».`,
      ],
    },
    {
      t: 'Кружочки со значками — планеты', focus: 'planets', aspects: [],
      paras: [
        'Каждый цветной кружок со значком — планета: ☉ Солнце, ☽ Луна, ☿ Меркурий, ♀ Венера, ♂ Марс, ♃ Юпитер, ♄ Сатурн, ♅ Уран, ♆ Нептун, ♇ Плутон, ⚷ Хирон, ☊ Северный узел.',
        'Значок стоит внутри кольца знаков: в каком ломтике кружок — в таком знаке планета, между какими лучами — в таком доме.',
        'Если две планеты родились рядом и кружки налезают друг на друга, один чуть сдвигают, чтобы было видно оба. Тонкая серая ниточка от такого кружка показывает его настоящее место.',
      ],
    },
    {
      t: 'Золотые линии и буквы ASC и MC — главные оси карты', focus: 'angles', aspects: [],
      paras: [
        'Две линии толще и золотее остальных, а за кольцом стоят буквы ASC и MC.',
        'ASC (Асцендент) — всегда строго слева, на «9 часах». Это знак, который восходил над горизонтом в момент рождения: ваш внешний образ, маска, первое впечатление.',
        'MC (Середина неба) — самая верхняя точка: карьера, призвание, вершина, к которой вы идёте.',
        `В вашей карте: ASC — ${degStr(c.h.asc)}, MC — ${degStr(c.h.mc)}. Подробно — во вкладке «Асцендент и MC».`,
      ],
    },
    {
      t: 'Зелёные линии в центре — гармоничные аспекты (помощь)', focus: 'aspects', aspects: good,
      paras: [
        'Зелёные линии соединяют планеты, которые дружат и помогают друг другу: трин (120°) — талант, данный от природы, секстиль (60°) — возможности, которые легко открываются. Бирюзовые линии — квинконс (150°): тонкая настройка, требующая маленьких поправок.',
        'Чем больше зелёного у планеты — тем легче она работает.',
        good.length ? `В вашей карте ${good.length} зелёных аспектов — например, ${good[0].aspect.name} между ${nm(good[0].a)} и ${nm(good[0].b)}.` : 'В вашей карте зелёных аспектов мало — всё даётся трудом, но и закалка сильнее.',
      ],
    },
    {
      t: 'Красные пунктирные линии — напряжённые аспекты (задачи)', focus: 'aspects', aspects: bad,
      paras: [
        'Красные линии соединяют планеты, которые спорят между собой: квадрат (90°) — внутренний конфликт, оппозиция (180°) — качели «или-или».',
        'Это не «плохо»: напряжение — мотор. Именно красные аспекты заставляют расти и дают самые большие достижения при проработке.',
        bad.length ? `В вашей карте ${bad.length} красных аспектов — например, ${bad[0].aspect.name} между ${nm(bad[0].a)} и ${nm(bad[0].b)}.` : 'В вашей карте нет красных аспектов — внутренних войн почти нет.',
      ],
    },
    {
      t: 'Золотая линия между планетами — соединение (слияние)', focus: 'aspects', aspects: conj,
      paras: [
        'Если две планеты стоят почти в одной точке (разница до ~8–10°), их рисуют золотой линией — это соединение.',
        'Энергии таких планет не разделить: они всегда действуют вместе, как один гибрид.',
        conj.length ? `В вашей карте: ${conj.map(a => `${nm(a.a)} + ${nm(a.b)}`).join(', ')}.` : 'В вашей карте соединений нет — каждая планета звучит отдельно.',
      ],
    },
    {
      t: 'Буква R у планеты — ретроградность', focus: 'planets', aspects: [],
      paras: [
        'Красная буква R у кружка значит: в момент рождения планета как будто «пятилась назад» по небу (это видимое движение, с Земли).',
        'Темы такой планеты обращены внутрь: они раскрываются позже и глубже, часто — через повторение уроков.',
        retroPts.length ? `У вас ретроградны: ${retroPts.map(p => nm(p.id)).join(', ')}. Расшифровка — во вкладке «Карма».` : 'В вашей карте нет ретроградных планет.',
      ],
    },
  ];
  $('#tab-schema').innerHTML = `
    <p class="hint">Разбор колеса по полочкам: ниже каждый элемент показан на отдельной мини-схеме — ярким оставлен только он, остальное приглушено. Все схемы построены по вашей карте.</p>
    ${items.map((it, i) => `<div class="card" open><summary><div class="card-head"><span class="card-title">${i + 1}. ${esc(it.t)}</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><div class="schema-wheel"><svg id="schemaWheel${i}" viewBox="0 0 760 760"></svg></div>
      ${it.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div></div>`).join('')}`;
  items.forEach((it, i) => drawWheel(document.getElementById('schemaWheel' + i), { ...base, aspects: it.aspects }, it.focus));
}

function renderPlanets(c) {
  $('#tab-planets').innerHTML = [...MAIN_PLANETS, 'Chiron'].map(id => planetSection(c, id)).join('');
}

function renderAngles(c) {
  const ascS = Math.floor(c.h.asc / 30), mcS = Math.floor(c.h.mc / 30);
  const ascAsp = c.angleAspects.filter(a => a.a === 'ASC' || a.b === 'ASC');
  const mcAsp = c.angleAspects.filter(a => a.a === 'MC' || a.b === 'MC');
  const rows = list => list.map(a => {
    const other = a.a === 'ASC' || a.a === 'MC' ? a.b : a.a;
    return `<div class="asp-row"><b>${a.aspect.glyph} ${a.aspect.name}</b> с ${gl(other)} ${nm(other)} <span class="orb">(орб ${a.orb}°)</span>${pairText(a.a, a.b) ? `<p class="asp-text">${esc(pairText(a.a, a.b))}</p>` : ''}</div>`;
  }).join('') || '<p class="hint">Мажорных аспектов нет</p>';
  $('#tab-angles').innerHTML = `
    <div class="card" open><summary><div class="card-head"><span class="card-title">Асцендент — ${degStr(c.h.asc)}</span><span class="card-sub">маска, первое впечатление, внешний образ</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>${esc(ASC_TEXTS[ascS])}</p><div class="blk"><span class="blk-label tip">Аспекты асцендента</span>${rows(ascAsp)}</div></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Середина неба (MC) — ${degStr(c.h.mc)}</span><span class="card-sub">карьера, призвание, положение в обществе</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>${esc(MC_TEXTS[mcS])}</p><div class="blk"><span class="blk-label tip">Аспекты MC</span>${rows(mcAsp)}</div></div></div>`;
}

function renderHouses(c) {
  const cards = c.h.cusps.slice(1).map((cu, i) => {
    const n = i + 1, sIdx = Math.floor(cu / 30);
    const inside = c.pts.filter(p => MAIN_PLANETS.includes(p.id) && p.house === n);
    return `<div class="card"><summary><div class="card-head"><span class="card-title">${n}-й дом — ${degStr(cu)}</span>
      <span class="card-sub">${HOUSE_DOMAIN[i]}</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>Дом отвечает за ${HOUSE_DOMAIN[i]}. В ${SIGNS[sIdx].prep} эта сфера окрашена качествами: ${SIGN_KEY[sIdx]}.</p>
      ${inside.length ? `<p><b>Планеты в доме:</b> ${inside.map(p => `${gl(p.id)} ${nm(p.id)}`).join(', ')} — смотрите их разборы во вкладке «Планеты».</p>` : '<p class="hint">Планет в доме нет — сфера реализуется через управителя знака куспида.</p>'}</div></div>`;
  }).join('');
  $('#tab-houses').innerHTML = cards;
}

// Порядок точек в аспектной сетке (как на geocult)
export const GRID_POINTS = [...MAIN_PLANETS, 'Chiron', 'Lilith', 'Selena', 'NorthNode', 'SouthNode', 'ParsFortuna', 'Vertex', 'ASC', 'MC'];

function aspectGrid(c) {
  const map = new Map();
  for (const a of c.aspects) map.set(`${a.a}|${a.b}`, a);
  const pts = GRID_POINTS.map(id => id === 'ASC' ? { id, lon: c.h.asc } : id === 'MC' ? { id, lon: c.h.mc } : c.pts.find(p => p.id === id)).filter(Boolean);
  const cellClass = a => a.aspect.id === 'conjunction' ? 'ag-conj' : a.aspect.id === 'quincunx' ? 'ag-quin' : a.aspect.nature > 0 ? 'ag-pos' : 'ag-neg';
  let html = '<div class="agrid-wrap"><table class="agrid"><thead><tr><th></th>';
  for (let j = 0; j < pts.length - 1; j++)
    html += `<th><span style="color:${PLANETS[pts[j].id].color}">${gl(pts[j].id)}</span>${pts[j].retro ? '<span class="retro">R</span>' : ''}</th>`;
  html += '</tr></thead><tbody>';
  for (let i = 1; i < pts.length; i++) {
    html += `<tr><th><span style="color:${PLANETS[pts[i].id].color}">${gl(pts[i].id)}</span>${pts[i].retro ? '<span class="retro">R</span>' : ''}</th>`;
    for (let j = 0; j < i; j++) {
      const a = map.get(`${pts[j].id}|${pts[i].id}`) || map.get(`${pts[i].id}|${pts[j].id}`);
      html += a
        ? `<td class="${cellClass(a)}" title="${nm(a.a)} — ${nm(a.b)}: ${a.aspect.name}, орб ${a.orb}°">${a.aspect.glyph}</td>`
        : '<td></td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  html += `<div class="agrid-legend">
    <span class="ag-conj">☌ Соединение 0°</span>
    <span class="ag-pos">△ Тригон 120° · ⚹ Секстиль 60° (гармоничные)</span>
    <span class="ag-quin">⚻ Квинконс 150° (настройка)</span>
    <span class="ag-neg">□ Квадрат 90° · ☍ Оппозиция 180° (напряжённые)</span>
    <span class="agrid-note">Наведите на ячейку — увидите орб. Орбы: до 8° для Солнца и Луны, 6–7° для планет, 2–3° для фиктивных точек.</span>
  </div>`;
  return html;
}

function renderAspects(c) {
  const rows = c.aspects.map(a => `<tr><td>${gl(a.a)} ${nm(a.a)}</td><td style="color:${a.aspect.nature < 0 ? 'var(--bad)' : a.aspect.nature > 0 ? 'var(--good)' : 'var(--gold)'}">${a.aspect.glyph} ${a.aspect.name}</td><td>${gl(a.b)} ${nm(a.b)}</td><td>${a.orb}°</td></tr>`).join('');
  const confs = c.configs.map(cf => `<div class="blk"><span class="blk-label tip">${cf.type}</span>
    <p><b>${cf.planets.map(p => `${gl(p)} ${nm(p)}`).join(' — ')}</b></p><p>${esc(CONFIG_TEXTS[cf.type] || '')}</p></div>`).join('');
  $('#tab-aspects').innerHTML = `
    <div class="card" open><summary><div class="card-head"><span class="card-title">Аспектная сетка</span><span class="card-sub">все взаимные аспекты точек карты, как в профессиональных программах</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body">${aspectGrid(c)}</div></div>
    <div class="card" open><summary><div class="card-head"><span class="card-title">Все аспекты</span><span class="card-sub">${c.aspects.length} шт., сортировка по орбу</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><table class="ntable"><thead><tr><th>Планета</th><th>Аспект</th><th>Планета</th><th>Орб</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    ${confs ? `<div class="card" open><summary><div class="card-head"><span class="card-title">Конфигурации</span></div><span class="card-chevron">▾</span></summary><div class="card-body">${confs}</div></div>` : ''}`;
}

function renderKarma(c) {
  const nn = c.pts.find(p => p.id === 'NorthNode'), sn = c.pts.find(p => p.id === 'SouthNode');
  const axis = NODE_AXIS[`${Math.floor(nn.lon / 30)}-${Math.floor(sn.lon / 30)}`] || '';
  const sel = c.pts.find(p => p.id === 'Selena'), lil = c.pts.find(p => p.id === 'Lilith');
  const pf = c.pts.find(p => p.id === 'ParsFortuna'), vtx = c.pts.find(p => p.id === 'Vertex');
  const retros = c.pts.filter(p => p.retro && RETRO_TEXT[p.id]);
  $('#tab-karma').innerHTML = `
    <div class="card" open><summary><div class="card-head"><span class="card-title">Кармические показатели</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>${esc(KARMIC_INTRO)}</p></div></div>
    ${retros.length ? `<div class="card"><summary><div class="card-head"><span class="card-title">Ретроградные планеты</span><span class="card-sub">${retros.map(p => nm(p.id)).join(', ')}</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body">${retros.map(p => `<div class="blk"><span class="blk-label warn">${gl(p.id)} ${nm(p.id)} R</span><p>${esc(RETRO_TEXT[p.id])}</p></div>`).join('')}</div></div>` : ''}
    <div class="card" open><summary><div class="card-head"><span class="card-title">Лунные узлы</span><span class="card-sub">☊ ${degStr(nn.lon)} (${nn.house}-й дом) · ☋ ${degStr(sn.lon)} (${sn.house}-й дом)</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>Лунные узлы символизируют ось развития: Нисходящий (Южный) узел — опыт прошлого, Восходящий (Северный) — опыт, который предстоит приобрести.</p><p>${esc(axis)}</p></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Селена (Белая Луна)</span><span class="card-sub">${degStr(sel.lon)}, ${sel.house}-й дом</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>Белая Луна — светлая карма: область, где накоплено больше всего добрых дел и где сияет дорога к успеху при проявлении высших качеств знака.</p><p>${esc(SELENA_IN_SIGN[Math.floor(sel.lon / 30)])}</p></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Лилит (Чёрная Луна)</span><span class="card-sub">${degStr(lil.lon)}, ${lil.house}-й дом</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>Чёрная Луна — теневая точка: искушения, соблазны и уроки, которые нужно осознать.</p><p>${esc(LILITH_IN_SIGN[Math.floor(lil.lon / 30)])}</p></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Парс Фортуны (Колесо Фортуны)</span><span class="card-sub">${degStr(pf.lon)}, ${pf.house}-й дом</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>${esc(PARS_IN_HOUSE[pf.house - 1])}</p></div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Вертекс</span><span class="card-sub">${degStr(vtx.lon)}, ${vtx.house}-й дом</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><p>${esc(VERTEX_TEXT)}</p></div></div>`;
}

function renderDyn(c) {
  const prows = MAIN_PLANETS.map(id => {
    const p = c.pts.find(x => x.id === id), s = c.strength[id];
    return `<tr><td><b style="color:${PLANETS[id].color}">${gl(id)}</b> ${nm(id)}</td><td>${s.force}</td><td class="${s.harmony >= 0 ? 'pos' : 'neg'}">${s.harmony}</td><td>${s.dignity.label}</td></tr>`;
  }).join('');
  $('#tab-dyn').innerHTML = `
    <p class="hint">Концентрация силы (астродины) по упрощённой модели: сила = достоинство + дом + аспектная связанность, гармония = достоинство + баланс гармоничных и напряжённых аспектов. Это ориентир относительной выраженности, а не точная реплика конкретной школы.</p>
    <div class="card" open><summary><div class="card-head"><span class="card-title">Сила и гармония планет</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body"><table class="ntable"><thead><tr><th>Планета</th><th>Сила</th><th>Гармония</th><th>Достоинство</th></tr></thead><tbody>${prows}</tbody></table></div></div>`;
}

function renderElements(c) {
  const cnt = { fire: 0, earth: 0, air: 0, water: 0 };
  const cross = [0, 0, 0];
  for (const id of MAIN_PLANETS) {
    const p = c.pts.find(x => x.id === id);
    const s = Math.floor(p.lon / 30);
    cnt[SIGNS[s].element]++; cross[s % 3]++;
  }
  const total = MAIN_PLANETS.length;
  const bars = Object.entries(cnt).map(([k, v]) => {
    const pct = Math.round(v / total * 100);
    return `<div class="chem-item"><div class="chem-head"><span class="chem-label">${ELEMENT_NAMES[k]}</span><span class="chem-val">${v} · ${pct}%</span></div>
      <div class="chem-track"><div class="chem-fill" style="--pct:${pct}%"></div></div>
      <p class="hint">${esc(ELEMENT_TEXTS[k])}</p></div>`;
  }).join('');
  const crosses = cross.map((v, i) => `<div class="chem-item"><div class="chem-head"><span class="chem-label">${CROSS_NAMES[i]}</span><span class="chem-val">${v}</span></div>
    <div class="chem-track"><div class="chem-fill" style="--pct:${Math.round(v / total * 100)}%"></div></div><p class="hint">${esc(CROSS_TEXTS[i])}</p></div>`).join('');
  const maxE = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  const minE = Object.entries(cnt).sort((a, b) => a[1] - b[1])[0];
  $('#tab-elements').innerHTML = `
    <div class="card" open><summary><div class="card-head"><span class="card-title">Баланс стихий</span><span class="card-sub">доминирует: ${ELEMENT_NAMES[maxE[0]]}; меньше всего: ${ELEMENT_NAMES[minE[0]]}</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body chem-list">${bars}</div></div>
    <div class="card"><summary><div class="card-head"><span class="card-title">Кресты (кресты качеств)</span></div><span class="card-chevron">▾</span></summary>
      <div class="card-body chem-list">${crosses}</div></div>`;
}

// ---------- Табы ----------
document.querySelectorAll('.chip').forEach(ch => ch.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.slide').forEach(x => x.classList.remove('active'));
  ch.classList.add('active');
  $('#tab-' + ch.dataset.tab).classList.add('active');
}));

// ---------- Кнопки ----------
$('#btnCalc').onclick = () => {
  try {
    render(calc(readForm()));
    saveCurrent();
  } catch (e) {
    toast(e.message);
  }
};

$('#btnShare').onclick = async () => {  if (!lastChart) return toast('Сначала сделайте расчёт');
  const f = lastChart.form;
  const q = new URLSearchParams({
    fn: f.name, fd: f.d, fm: f.m, fy: f.y, fh: f.hh, fmn: f.mm,
    c: $('#city').value, lt: f.lat, ln: f.lon, tz: f.utc,
  });
  const link = location.origin + location.pathname + '?' + q.toString();
  try { await navigator.clipboard.writeText(link); toast('Ссылка скопирована'); }
  catch { prompt('Скопируйте ссылку:', link); }
};

$('#btnPdf').onclick = async () => {
  if (!lastChart) return toast('Сначала сделайте расчёт');
  const btn = $('#btnPdf');
  btn.disabled = true; btn.textContent = 'Готовим PDF…';
  try {
    const { downloadPdf } = await import('./pdf.js?v=3');
    await downloadPdf(lastChart, $('#city').value, $('#wheelSvg'));
    toast('PDF сохранён');
  } catch (e) {
    toast('Не удалось создать PDF: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Скачать PDF';
  }
};

// ---------- Сохранённые ----------
const LS_KEY = 'natal.saved';
function saveCurrent() {
  const f = lastChart.form;
  const rec = { name: f.name || 'Без имени', city: $('#city').value, y: f.y, m: f.m, d: f.d, hh: f.hh, mm: f.mm, lat: f.lat, lon: f.lon, utc: f.utc };
  const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]').filter(x => JSON.stringify(x) !== JSON.stringify(rec));
  arr.unshift(rec);
  localStorage.setItem(LS_KEY, JSON.stringify(arr.slice(0, 20)));
  renderSaved();
}
function renderSaved() {
  const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  $('#savedList').innerHTML = arr.map((r, i) => `<div class="saved-item">
    <button class="btn-ghost saved-open" data-i="${i}"><b>${esc(r.name)}</b><span>${String(r.d).padStart(2, '0')}.${String(r.m).padStart(2, '0')}.${r.y} ${String(r.hh).padStart(2, '0')}:${String(r.mm).padStart(2, '0')} · ${esc(r.city)}</span></button>
    <button class="saved-del" data-i="${i}" title="Удалить">✕</button></div>`).join('');
  $('#savedWrap').hidden = !arr.length;
}
$('#savedList').addEventListener('click', e => {
  const open = e.target.closest('.saved-open'), del = e.target.closest('.saved-del');
  const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  if (del) { arr.splice(+del.dataset.i, 1); localStorage.setItem(LS_KEY, JSON.stringify(arr)); renderSaved(); return; }
  if (open) {
    const r = arr[+open.dataset.i];
    $('#name').value = r.name; $('#date').value = `${r.y}-${String(r.m).padStart(2, '0')}-${String(r.d).padStart(2, '0')}`;
    $('#time').value = `${String(r.hh).padStart(2, '0')}:${String(r.mm).padStart(2, '0')}`;
    $('#city').value = r.city; $('#lat').value = r.lat; $('#lon').value = r.lon;
    $('#utc').value = Math.floor(r.utc); $('#dst').checked = r.utc % 1 !== 0 || false;
    $('#btnCalc').click();
  }
});

// ---------- Восстановление из URL ----------
(function fromUrl() {
  const q = new URLSearchParams(location.search);
  if (!q.get('fy')) { renderSaved(); return; }
  $('#name').value = q.get('fn') || '';
  $('#date').value = `${q.get('fy')}-${String(+q.get('fm')).padStart(2, '0')}-${String(+q.get('fd')).padStart(2, '0')}`;
  $('#time').value = `${String(+q.get('fh') || 12).padStart(2, '0')}:${String(+q.get('fmn') || 0).padStart(2, '0')}`;
  $('#city').value = q.get('c') || '';
  $('#lat').value = q.get('lt') || ''; $('#lon').value = q.get('ln') || '';
  const tz = parseFloat(q.get('tz'));
  $('#utc').value = Math.floor(tz); $('#dst').checked = Math.abs(tz % 1) > 0.01;
  renderSaved();
  if ($('#lat').value) $('#btnCalc').click();
})();

// Значения по умолчанию — демо как на лендинге матрицы
if (!location.search) {
  $('#date').value = '2006-06-10'; $('#time').value = '22:00';
  cityInput.value = 'Шилово, Россия';
  const c = searchLocalCities('Шилово')[0];
  if (c) pickCity(c);
  $('#utc').value = 3; $('#dst').checked = true;
}
