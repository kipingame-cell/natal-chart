// Регрессионный тест: полная аспектная сетка vs geocult (22.01.2003 13:30 GMT+5, Пермь)
// Эталон: 34 аспекта, из них 5 квинконсов; взаимный аспект ASC–MC не считается.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.Astronomy = require('../public/vendor/astronomy.js');

const { julianDay, computePoints, norm360 } = await import('../public/js/astro/core.js');
const { houses, houseOf, parsFortunae } = await import('../public/js/astro/houses.js');
const { findAspects } = await import('../public/js/astro/aspects.js');

const jd = julianDay(2003, 1, 22, 8.5); // 13:30 GMT+5
const pts = computePoints(jd);
const h = houses(jd, 58.0104, 56.2501);
for (const p of pts) p.house = houseOf(p.lon, h.cusps);
const sun = pts.find(p => p.id === 'Sun'), moon = pts.find(p => p.id === 'Moon');
pts.push({ id: 'ParsFortuna', lon: parsFortunae(h.asc, sun.lon, moon.lon, sun.house) });
pts.push({ id: 'Vertex', lon: h.vertex });
pts.push({ id: 'SouthNode', lon: norm360(pts.find(p => p.id === 'NorthNode').lon + 180) });
const asps = findAspects([...pts, { id: 'ASC', lon: h.asc }, { id: 'MC', lon: h.mc }]);

const has = (a, b, aspId) => asps.find(x =>
  ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && (!aspId || x.aspect.id === aspId));

test('сетка 2003: ровно 34 аспекта, из них 5 квинконсов', () => {
  assert.equal(asps.length, 34);
  assert.equal(asps.filter(a => a.aspect.id === 'quincunx').length, 5);
});

test('сетка 2003: ключевые аспекты geocult', () => {
  assert.ok(has('Moon', 'Uranus', 'quincunx'), 'Луна квинконс Уран (орб ~4.94)');
  assert.ok(has('Sun', 'MC', 'conjunction'), 'Солнце соединение MC');
  assert.ok(has('ASC', 'Chiron', 'quincunx'), 'ASC квинконс Хирон (орб ~5.85)');
  assert.ok(has('NorthNode', 'SouthNode', 'opposition'), 'узлы в оппозиции');
});

test('сетка 2003: отсечения по орбам совпадают с geocult', () => {
  assert.ok(!has('Lilith', 'Sun'), 'Лилит квадрат Солнце (орб 4.01) отсекался');
  assert.ok(!has('Mars', 'Uranus'), 'Марс квадрат Уран (орб 6.02) отсекался');
  assert.ok(!has('ASC', 'MC'), 'взаимный аспект ASC–MC не считается');
  assert.ok(!has('NorthNode', 'ParsFortuna'), 'узел трин Парс (орб 2.14) отсекался');
});
