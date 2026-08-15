// Обобщённый вывод по карте — общий строитель для вкладки «Вывод» и PDF.
import { SIGNS, PLANETS, ELEMENT_NAMES, CROSS_NAMES } from './astro/format.js';
import { PLANET_IN_SIGN, RETRO_TEXT } from './data/texts_planet_sign.js';
import { ASC_TEXTS, NODE_AXIS, CONFIG_TEXTS } from './data/texts_angles.js';
import { PLANET_ABOUT, ELEMENT_TEXTS, CROSS_TEXTS } from './data/texts_pairs.js';

export const MAIN_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

const EL_ORDER = ['fire', 'earth', 'air', 'water'];

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
  const elSorted = EL_ORDER.map(k => [k, cnt[k]]).sort((a, b) => b[1] - a[1]);
  const [maxE, minE] = [elSorted[0], elSorted[elSorted.length - 1]];
  const secondE = elSorted[1];
  const maxC = cross.indexOf(Math.max(...cross));
  const minC = cross.indexOf(Math.min(...cross));

  // сила/гармония
  const ranked = MAIN_PLANETS.map(id => ({ id, ...c.strength[id] })).sort((a, b) => b.force - a.force);
  const strongest = ranked[0], second = ranked[1];
  const byHarmony = [...ranked].sort((a, b) => b.harmony - a.harmony);
  const mostHarm = byHarmony[0], mostTense = byHarmony[byHarmony.length - 1];
  const secondTense = byHarmony[byHarmony.length - 2];
  const P = id => PLANETS[id].name;
  const pSign = id => signName(pts(id));

  const blocks = [];

  blocks.push({
    head: 'Как вас видят люди',
    paras: [
      `Асцендент (восходящий знак) — это «витрина» личности: внешний образ, манеры, первое впечатление, которое вы производите на незнакомых людей, и привычный способ начинать любое дело. У вас асцендент в знаке ${SIGNS[Math.floor(c.h.asc / 30)].name}.`,
      ASC_TEXTS[Math.floor(c.h.asc / 30)],
      `Помните: асцендент — это то, как вас воспринимают снаружи, а не обязательно то, кем вы являетесь внутри. За внутреннее содержание отвечают прежде всего Солнце и Луна — о них ниже.`,
    ],
  });

  blocks.push({
    head: 'Ядро личности',
    paras: [
      `Солнце — ваше «Я», воля, жизненная сила и творческий импульс. Оно показывает, кем вы стремитесь быть и где вам важно проявиться. У вас Солнце в знаке ${signName(sun)}, в ${sun.house}-м доме гороскопа. ${inSign('Sun', sun)}`,
      `Луна — эмоции, привычки, подсознание и внутренний комфорт: то, что вам нужно, чтобы чувствовать себя хорошо и в безопасности. У вас Луна в знаке ${signName(moon)}, в ${moon.house}-м доме. ${inSign('Moon', moon)}`,
      `Солнце и Луна вместе — главная ось характера: Солнце отвечает за цели и самовыражение, Луна — за потребности и реакции. Когда их темы дружат, человек чувствует внутреннее согласие; когда расходятся — важно осознанно давать выход и тому, и другому началу.`,
    ],
  });

  // Темперамент — полный разбор стихий и крестов
  const tempParas = [
    `Распределение десяти планет по стихиям: Огонь — ${cnt.fire}, Земля — ${cnt.earth}, Воздух — ${cnt.air}, Вода — ${cnt.water}. Доминирует стихия «${ELEMENT_NAMES[maxE[0]]}» (${maxE[1]} из 10), на втором месте — «${ELEMENT_NAMES[secondE[0]]}» (${secondE[1]}), меньше всего — «${ELEMENT_NAMES[minE[0]]}» (${minE[1]}).`,
    `Ведущая стихия — «${ELEMENT_NAMES[maxE[0]]}». ${ELEMENT_TEXTS[maxE[0]]} Это ваш естественный способ действия: именно через качества этой стихии вы быстрее всего добиваетесь результата и восстанавливаете силы.`,
  ];
  if (secondE[1] >= maxE[1] - 1) {
    tempParas.push(`Опорная стихия — «${ELEMENT_NAMES[secondE[0]]}». ${ELEMENT_TEXTS[secondE[0]]} Она заметно подпитывает ведущую, поэтому в вашем темпераменте читаются обе линии.`);
  }
  if (minE[1] <= 1) {
    tempParas.push(`Слабо представлена стихия «${ELEMENT_NAMES[minE[0]]}» (${minE[1]} из 10). ${ELEMENT_TEXTS[minE[0]]} Это не дефект, а зона осознанного роста: качества слабой стихии стоит развивать намеренно — через практики, окружение и привычки, а не ждать, что они включатся сами.`);
  } else {
    tempParas.push(`Ярко выраженного «провала» по стихиям нет: каждая представлена как минимум ${minE[1]} планетами, поэтому все четыре способа реагирования вам доступны.`);
  }
  tempParas.push(
    `По крестам (типу реагирования): кардинальный — ${cross[0]}, фиксированный — ${cross[1]}, мутабельный — ${cross[2]}. Преобладает ${CROSS_NAMES[maxC].toLowerCase()} тип. ${CROSS_TEXTS[maxC]}`
  );
  if (Math.max(...cross) - Math.min(...cross) >= 4) {
    tempParas.push(`Перекос по крестам заметный: сильная сторона — это ваш природный режим действия, а качества слабо представленного типа (${CROSS_NAMES[minC].toLowerCase()} — ${CROSS_TEXTS[minC].toLowerCase()}) придётся тренировать осознанно.`);
  }
  tempParas.push(
    maxE[1] - minE[1] >= 3
      ? 'Итог: баланс темперамента заметно смещён — сильные стороны яркие и работают автоматически, зато зона слабой стихии требует внимания. Люди с таким перекосом ярко проявлены в «своей» среде и заметно тратят силы вне её.'
      : 'Итог: стихии распределены довольно ровно — темперамент гибкий, без выраженного перекоса: вам проще подстраиваться под разные ситуации и людей.'
  );
  blocks.push({ head: 'Темперамент', paras: tempParas });

  // Сильные стороны — развёрнуто
  const strongParas = [
    `Самая сильная планета вашей карты — ${P(strongest.id)} в знаке ${pSign(strongest.id)} (сила ${strongest.force}, ${strongest.dignity.label}). ${PLANET_ABOUT[strongest.id]} У вас эта планета работает почти автоматически: её качества — ваш природный инструмент, к которому стоит обращаться в первую очередь.`,
    `Вторая по силе — ${P(second.id)} в знаке ${pSign(second.id)} (сила ${second.force}, ${second.dignity.label}). ${PLANET_ABOUT[second.id]} В связке с ведущей планетой она даёт устойчивую опору: там, где темы ${P(strongest.id)} и ${P(second.id)} пересекаются, вы сильнее всего.`,
  ];
  if (mostHarm.harmony > 0) {
    strongParas.push(`Наиболее гармонична ${P(mostHarm.id)} в знаке ${pSign(mostHarm.id)} (гармония ${mostHarm.harmony}): здесь у вас природный талант — то, что получается легко и даётся «бесплатно». Такие зоны важно не просто иметь, а использовать: именно через них приходят удача и благодарность от людей.`);
  } else {
    strongParas.push('Выраженного «бесплатного» ресурса по гармонии нет — это значит, что ваши достижения строятся не на везении, а на осознанной работе, и потому особенно устойчивы.');
  }
  const harmCf = c.configs.filter(cf => ['Большой тригон', 'Бисекстиль', 'Парус'].includes(cf.type));
  for (const cf of harmCf) {
    strongParas.push(`${cf.type} (${cf.planets.map(p => P(p)).join(' — ')}) — редкая гармоничная конфигурация, усиливающая ресурс карты. ${CONFIG_TEXTS[cf.type]}`);
  }
  strongParas.push('Практический вывод: опирайтесь на сильные планеты в выборе дела, роли и окружения — там, где задействованы их темы, вы действуете эффективнее большинства и быстрее восстанавливаетесь.');
  blocks.push({ head: 'Сильные стороны и ресурсы', paras: strongParas });

  // Зоны роста — развёрнуто
  const growParas = [];
  if (mostTense.harmony < 0) {
    growParas.push(`Самая напряжённая планета — ${P(mostTense.id)} в знаке ${pSign(mostTense.id)} (гармония ${mostTense.harmony}). ${PLANET_ABOUT[mostTense.id]} В вашей карте её темы — самые чувствительные: здесь возможны повторяющиеся сложности, внутренние запреты или «притянутые» извне испытания. Именно эта планета требует внимания и проработки в первую очередь.`);
    if (secondTense.harmony < 0) {
      growParas.push(`Вторая зона напряжения — ${P(secondTense.id)} в знаке ${pSign(secondTense.id)} (гармония ${secondTense.harmony}). ${PLANET_ABOUT[secondTense.id]} В паре с ${P(mostTense.id)} она показывает, какие сферы жизни чаще всего становятся «точками роста».`);
    }
  } else {
    growParas.push('Явно напряжённых планет в карте нет — она в целом мягкая: серьёзных внутренних конфликтов по планетарным темам не просматривается.');
  }
  const tenseCf = c.configs.filter(cf => ['Тау-квадрат', 'Большой крест'].includes(cf.type));
  for (const cf of tenseCf) {
    growParas.push(`${cf.type} (${cf.planets.map(p => P(p)).join(' — ')}) — сильная напряжённая конфигурация, встроенный двигатель развития. ${CONFIG_TEXTS[cf.type]}`);
  }
  const retros = MAIN_PLANETS.map(pts).filter(p => p && p.retro && RETRO_TEXT[p.id]);
  if (retros.length) {
    growParas.push(`Ретроградные планеты (${retros.map(p => P(p.id)).join(', ')}) — темы, которые разворачиваются внутрь и требуют времени: по ним человек часто «пересдаёт экзамены» жизни, зато приобретает нестандартный, глубокий опыт. ${RETRO_TEXT[retros[0].id]}`);
  }
  growParas.push(`Слабая стихия («${ELEMENT_NAMES[minE[0]]}») и напряжённые планеты — не приговор, а карта тренировок: астрологическая практика показывает, что усилие, вложенное именно в эти зоны, даёт максимальный результат и в итоге превращает уязвимости в уникальные компетенции.`);
  blocks.push({ head: 'Зоны роста', paras: growParas });

  blocks.push({
    head: 'Кармическая ось',
    paras: [
      `Лунные узлы — самая важная кармическая ось гороскопа. Южный узел в знаке ${signName(sn)}, ${sn.house}-й дом — это багаж прошлого: привычные сценарии, таланты и модели поведения, которые уже освоены и включаются сами. Северный узел в знаке ${signName(nn)}, ${nn.house}-й дом — вектор развития: качества и сферы, куда жизнь настойчиво зовёт и где достижения дают самое глубокое удовлетворение.`,
      NODE_AXIS[`${Math.floor(nn.lon / 30)}-${Math.floor(sn.lon / 30)}`] || '',
      `Движение по оси — это не отказ от прошлого, а расширение: опыт Южного узла остаётся с вами, но опорой и целью становится Северный. Ориентир простой: где знакомо и легко, но пусто в итоге — там Южный; где страшновато, но наполненно — там Северный.`,
    ],
  });
  return blocks;
}
