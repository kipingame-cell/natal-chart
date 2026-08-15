// Обобщённый вывод по карте — общий строитель для вкладки «Вывод» и PDF.
import { SIGNS, PLANETS, ELEMENT_NAMES, CROSS_NAMES } from './astro/format.js';
import { PLANET_IN_SIGN } from './data/texts_planet_sign.js';
import { ASC_TEXTS, NODE_AXIS, CONFIG_TEXTS } from './data/texts_angles.js';

export const MAIN_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

const firstSentence = t => { const i = t.indexOf('. '); return i > 0 ? t.slice(0, i + 1) : t; };

export function buildSummary(c) {
  const pts = id => c.pts.find(p => p.id === id);
  const sun = pts('Sun'), moon = pts('Moon');
  const nn = pts('NorthNode'), sn = pts('SouthNode');
  const signName = p => SIGNS[Math.floor(p.lon / 30)].name;
  const inSign = (id, p) => PLANET_IN_SIGN[id]?.[Math.floor(p.lon / 30)] || '';

  // стихии и кресты
  const cnt = { fire: 0, earth: 0, air: 0, water: 0 };
  const cross = [0, 0, 0];
  for (const id of MAIN_PLANETS) {
    const s = Math.floor(pts(id).lon / 30);
    cnt[SIGNS[s].element]++; cross[s % 3]++;
  }
  const elSorted = Object.entries(cnt).sort((a, b) => b[1] - a[1]);
  const maxE = elSorted[0], minE = elSorted[elSorted.length - 1];
  const maxC = cross.indexOf(Math.max(...cross));

  // сила/гармония
  const ranked = MAIN_PLANETS.map(id => ({ id, ...c.strength[id] })).sort((a, b) => b.force - a.force);
  const strongest = ranked[0];
  const byHarmony = [...ranked].sort((a, b) => b.harmony - a.harmony);
  const mostHarm = byHarmony[0], mostTense = byHarmony[byHarmony.length - 1];
  const P = id => PLANETS[id].name;

  const blocks = [];
  blocks.push({
    head: 'Как вас видят люди',
    paras: [
      `Асцендент (внешний образ и первое впечатление) — ${SIGNS[Math.floor(c.h.asc / 30)].name}.`,
      firstSentence(ASC_TEXTS[Math.floor(c.h.asc / 30)]),
    ],
  });
  blocks.push({
    head: 'Ядро личности',
    paras: [
      `Солнце (ваше «Я», воля и жизненная сила) — в знаке ${signName(sun)}, ${sun.house}-й дом. ${firstSentence(inSign('Sun', sun))}`,
      `Луна (эмоции, привычки, внутренний комфорт) — в знаке ${signName(moon)}, ${moon.house}-й дом. ${firstSentence(inSign('Moon', moon))}`,
      `Солнце отвечает за то, кем вы хотите быть; Луна — за то, что вам нужно, чтобы чувствовать себя хорошо. Вместе они — главная ось характера.`,
    ],
  });
  blocks.push({
    head: 'Темперамент',
    paras: [
      `Доминирует стихия «${ELEMENT_NAMES[maxE[0]]}» (${maxE[1]} из 10 планет), меньше всего — «${ELEMENT_NAMES[minE[0]]}» (${minE[1]}). Преобладает ${CROSS_NAMES[maxC].toLowerCase()} тип реагирования.`,
      maxE[1] - minE[1] >= 3
        ? 'Баланс заметно смещён: сильные стороны яркие, но зона слабой стихии — то, чему придётся учиться осознанно.'
        : 'Стихии распределены довольно ровно — характер гибкий, без выраженного перекоса.',
    ],
  });
  blocks.push({
    head: 'Сильные стороны и ресурсы',
    paras: [
      `Самая сильная планета — ${P(strongest.id)} (сила ${strongest.force}, ${strongest.dignity.label}): её качества работают у вас почти автоматически.`,
      mostHarm.harmony > 0 ? `Наиболее гармонична ${P(mostHarm.id)} (гармония ${mostHarm.harmony}) — природный талант, опирайтесь на неё.` : `Выраженного «бесплатного» ресурса по гармонии нет — всё достаётся через осознанную работу.`,
      ...c.configs.filter(cf => ['Большой тригон', 'Бисекстиль', 'Парус'].includes(cf.type))
        .map(cf => `${cf.type} (${cf.planets.map(p => P(p)).join(' — ')}): ${CONFIG_TEXTS[cf.type]}`),
    ],
  });
  blocks.push({
    head: 'Зоны роста',
    paras: [
      mostTense.harmony < 0 ? `Самая напряжённая планета — ${P(mostTense.id)} (гармония ${mostTense.harmony}): её темы требуют внимания и проработки.` : 'Явно напряжённых планет нет — карта в целом мягкая.',
      ...c.configs.filter(cf => ['Тау-квадрат', 'Большой крест'].includes(cf.type))
        .map(cf => `${cf.type} (${cf.planets.map(p => P(p)).join(' — ')}): ${CONFIG_TEXTS[cf.type]}`),
      'Напряжённые аспекты — не приговор: это точки наибольшего роста, где усилие даёт максимальный результат.',
    ],
  });
  blocks.push({
    head: 'Кармическая ось',
    paras: [
      `Ось Узлов: прошлое — ${signName(sn)} (Южный узел, ${sn.house}-й дом), вектор развития — ${signName(nn)} (Северный узел, ${nn.house}-й дом).`,
      NODE_AXIS[`${Math.floor(nn.lon / 30)}-${Math.floor(sn.lon / 30)}`] || '',
    ],
  });
  return blocks;
}
