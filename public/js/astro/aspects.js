// Аспекты и конфигурации аспектов.
import { norm360 } from './core.js';

// Мажорные аспекты с орбами (школа, близкая к geocult)
export const ASPECTS = [
  { id: 'conjunction', name: 'Соединение', angle: 0, orb: 8, glyph: '☌', nature: 0 },
  { id: 'sextile', name: 'Секстиль', angle: 60, orb: 6, glyph: '⚹', nature: 1 },
  { id: 'square', name: 'Квадрат', angle: 90, orb: 8, glyph: '□', nature: -1 },
  { id: 'trine', name: 'Тригон', angle: 120, orb: 8, glyph: '△', nature: 1 },
  { id: 'opposition', name: 'Оппозиция', angle: 180, orb: 8, glyph: '☍', nature: -1 },
];

// Узкие орбы для фиктивных точек
const TIGHT = new Set(['NorthNode', 'Selena', 'Lilith', 'ParsFortuna', 'Vertex', 'ASC', 'MC']);

export function angleBetween(a, b) {
  return Math.abs(norm360(a - b + 180) - 180);
}

// points: [{id, lon}]; возвращает [{a, b, aspect, orb, exact}]
export function findAspects(points) {
  const out = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const p = points[i], q = points[j];
      const d = angleBetween(p.lon, q.lon);
      const orbMax = (TIGHT.has(p.id) || TIGHT.has(q.id)) ? 5 : null;
      for (const asp of ASPECTS) {
        const orb = Math.abs(d - asp.angle);
        const max = orbMax !== null ? Math.min(orbMax, asp.orb) : asp.orb;
        if (orb <= max) {
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
