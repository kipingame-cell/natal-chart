import test from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.Astronomy = require('../public/vendor/astronomy.js');

const { julianDay, computePoints } = await import('../public/js/astro/core.js');
const { houses, houseOf, parsFortunae } = await import('../public/js/astro/houses.js');

const closeTo = (a, b, tol, msg) => {
  let d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  assert.ok(d <= tol, `${msg}: got ${a.toFixed(4)}, want ${b.toFixed(4)} (diff ${d.toFixed(4)})`);
};

// Референс 1: 10.06.2006 22:00 GMT+4, Шилово 54.3204N 40.8740E
const jd1 = julianDay(2006, 6, 10, 18);
test('planets 2006-06-10 18UT vs geocult', () => {
  const pts = computePoints(jd1);
  const ref = { Sun: 79.7174, Moon: 247.1350, Mercury: 101.9344, Venus: 44.3134, Mars: 124.2110, Jupiter: 219.9473, Saturn: 127.9897, Uranus: 344.6992, Neptune: 319.7193, Pluto: 265.5808, Chiron: 309.3723, NorthNode: 1.0631, Selena: 213.7811, Lilith: 165.4600 };
  for (const [id, v] of Object.entries(ref)) {
    const p = pts.find(p => p.id === id);
    closeTo(p.lon, v, id === 'Chiron' ? 1.5 : (id === 'Selena' ? 0.05 : (id === 'Lilith' ? 0.15 : 0.1)), id);
  }
});

test('houses 2006 Placidus vs geocult', () => {
  const h = houses(jd1, 54.3204, 40.8740);
  const refCusps = [null, 263.5728, 309.6276, 359.7591, 31.9977, 52.9564, 68.9677, 83.5728, 129.6276, 179.7591, 211.9977, 232.9564, 248.9677];
  for (let i = 1; i <= 12; i++) closeTo(h.cusps[i], refCusps[i], 0.15, 'cusp ' + i);
  closeTo(h.vertex, 130.5363, 0.15, 'vertex');
});

test('pars fortunae 2006 (ночная карта)', () => {
  const pts = computePoints(jd1);
  const h = houses(jd1, 54.3204, 40.8740);
  const sun = pts.find(p => p.id === 'Sun'), moon = pts.find(p => p.id === 'Moon');
  const sunHouse = houseOf(sun.lon, h.cusps);
  closeTo(parsFortunae(h.asc, sun.lon, moon.lon, sunHouse), 96.1552, 0.3, 'pars');
});

// Референс 2: 15.03.1995 12:00 GMT+3
const jd2 = julianDay(1995, 3, 15, 9);
test('planets 1995-03-15 09UT vs geocult', () => {
  const pts = computePoints(jd2);
  const ref = { Sun: 354.3125, Moon: 152.8504, Mercury: 330.6797, Venus: 314.6957, Mars: 133.7136, Jupiter: 254.9270, Saturn: 346.1526, Uranus: 299.4204, Neptune: 295.0368, Pluto: 240.5686, Chiron: 173.1912, NorthNode: 216.2978, Selena: 355.6553, Lilith: 67.9517 };
  for (const [id, v] of Object.entries(ref)) {
    const p = pts.find(p => p.id === id);
    closeTo(p.lon, v, id === 'Chiron' ? 1.5 : (id === 'Selena' ? 0.05 : (id === 'Lilith' ? 0.15 : 0.1)), id);
  }
});

test('houses 1995 Placidus vs geocult', () => {
  const h = houses(jd2, 54.3204, 40.8740);
  const refCusps = [null, 110.6462, 125.1116, 142.7620, 167.3612, 204.7266, 253.1116, 290.6462, 305.1116, 322.7620, 347.3612, 24.7266, 73.1116];
  for (let i = 1; i <= 12; i++) closeTo(h.cusps[i], refCusps[i], 0.15, 'cusp ' + i);
  closeTo(h.vertex, 244.3429, 0.15, 'vertex');
});

test('pars fortunae 1995 (дневная карта)', () => {
  const pts = computePoints(jd2);
  const h = houses(jd2, 54.3204, 40.8740);
  const sun = pts.find(p => p.id === 'Sun'), moon = pts.find(p => p.id === 'Moon');
  const sunHouse = houseOf(sun.lon, h.cusps);
  closeTo(parsFortunae(h.asc, sun.lon, moon.lon, sunHouse), 269.1841, 0.3, 'pars');
});
