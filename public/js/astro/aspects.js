// Аспекты и конфигурации аспектов.
import { norm360 } from './core.js';

// Аспекты (включая квинконс 150°). Орбы — схема, реверс-инжинирингом снятая с geocult
// (проверена на трёх эталонных картах: наборы аспектов совпадают 34/34, 40/40, 33/33).
export const ASPECTS = [
  { id: 'conjunction', name: 'Соединение', angle: 0, orb: 8, glyph: '☌', nature: 0 },
  { id: 'sextile', name: 'Секстиль', angle: 60, orb: 6, glyph: '⚹', nature: 1 },
  { id: 'square', name: 'Квадрат', angle: 90, orb: 8, glyph: '□', nature: -1 },
  { id: 'trine', name: 'Тригон', angle: 120, orb: 8, glyph: '△', nature: 1 },
  { id: 'quincunx', name: 'Квинконс', angle: 150, orb: 8, glyph: '⚻', nature: 1 },
  { id: 'opposition', name: 'Оппозиция', angle: 180, orb: 8, glyph: '☍', nature: -1 },
];

// Индивидуальный потолок орба для каждой точки; для пары берётся минимум.
// Схема снята с geocult реверс-инжинирингом (эталоны 2003/2006/1995: полное совпадение наборов).
export const ORB_CAP = {
  Sun: 8, Moon: 8, Mercury: 6, Venus: 7, Mars: 6, Jupiter: 6, Saturn: 6,
  Uranus: 6.5, Neptune: 6.5, Pluto: 6.5, Chiron: 6, ASC: 6, MC: 6,
  Vertex: 3, Lilith: 2.1, Selena: 2.8, NorthNode: 2.8, SouthNode: 2.8, ParsFortuna: 2,
};
// У квинконса свои потолки (у большинства «настоящих» точек шире — до 8°).
const QUINCUNX_CAP = {
  Sun: 8, Moon: 8, Mercury: 6, Venus: 8, Mars: 8, Jupiter: 8, Saturn: 6,
  Uranus: 6, Neptune: 8, Pluto: 8, Chiron: 8, ASC: 6, MC: 6,
  Vertex: 3, Lilith: 2.1, Selena: 2.8, NorthNode: 2.8, SouthNode: 2.8, ParsFortuna: 2,
};
const DEFAULT_CAP = 5;

export function angleBetween(a, b) {
  return Math.abs(norm360(a - b + 180) - 180);
}

// points: [{id, lon}]; возвращает [{a, b, aspect, orb, exact}]
export function findAspects(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i], q = points[j];
      // geocult не показывает взаимный аспект осей ASC–MC
      if ((p.id === 'ASC' && q.id === 'MC') || (p.id === 'MC' && q.id === 'ASC')) continue;
      const d = angleBetween(p.lon, q.lon);
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        const caps = asp.id === 'quincunx' ? QUINCUNX_CAP : ORB_CAP;
        const cap = Math.min(caps[p.id] ?? DEFAULT_CAP, caps[q.id] ?? DEFAULT_CAP);
        if (orb <= Math.min(cap, asp.orb)) {
          out.push({ a: p.id, b: q.id, aspect: asp, orb: +orb.toFixed(2), la: p.lon, lb: q.lon });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

const has = (asps, x, y, ids) => asps.some(s =>
  ids.includes(s.aspect.id) && ((s.a === x && s.b === y) || (s.a === y && s.b === x)));

// Конфигурации: Большой тригон, Тау-квадрат, Бисекстиль, Парус, Большой крест
export function findConfigurations(planetIds, asps) {
  const conf = [];
  const ids = planetIds;
  const trip = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (let k = j + 1; k < ids.length; k++) trip.push([ids[i], ids[j], ids[k]]);

  for (const [x, y, z] of trip) {
    if (has(asps, x, y, ['trine']) && has(asps, y, z, ['trine']) && has(asps, x, z, ['trine'])) {
      conf.push({ type: 'Большой тригон', planets: [x, y, z] });
      // Парус (воздушный змей): 4-я планета в оппозиции к одной вершине и в секстилях к двум другим
      for (const w of ids) {
        if ([x, y, z].includes(w)) continue;
        for (const apex of [x, y, z]) {
          const others = [x, y, z].filter(o => o !== apex);
          if (has(asps, w, apex, ['opposition']) && has(asps, w, others[0], ['sextile']) && has(asps, w, others[1], ['sextile'])) {
            conf.push({ type: 'Парус', planets: [apex, ...others, w] });
          }
        }
      }
    }
  }
  for (const [x, y, z] of trip) {
    // Тау-квадрат: две квадратуры + оппозиция
    const pairs = [[x, y], [y, z], [x, z]];
    const opp = pairs.filter(([a, b]) => has(asps, a, b, ['opposition']));
    const sq = pairs.filter(([a, b]) => has(asps, a, b, ['square']));
    if (opp.length === 1 && sq.length === 2) conf.push({ type: 'Тау-квадрат', planets: [x, y, z] });
  }
  // Большой крест: 4 планеты, 4 квадрата + 2 оппозиции
  for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++)
    for (let c = b + 1; c < ids.length; c++) for (let d = c + 1; d < ids.length; d++) {
      const quad = [ids[a], ids[b], ids[c], ids[d]];
      const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]].map(([m, n]) => [quad[m], quad[n]]);
      const nSq = pairs.filter(([p, q]) => has(asps, p, q, ['square'])).length;
      const nOpp = pairs.filter(([p, q]) => has(asps, p, q, ['opposition'])).length;
      if (nSq === 4 && nOpp === 2) conf.push({ type: 'Большой крест', planets: quad });
    }
  // Бисекстиль: два секстиля + тригон (вершина — планета с двумя секстилями)
  for (const [x, y, z] of trip) {
    const pairs = [[x, y], [y, z], [x, z]];
    const tri = pairs.filter(([a, b]) => has(asps, a, b, ['trine']));
    const sex = pairs.filter(([a, b]) => has(asps, a, b, ['sextile']));
    if (tri.length === 1 && sex.length === 2) {
      conf.push({ type: 'Бисекстиль', planets: [x, y, z] });
    }
  }
  return conf;
}
