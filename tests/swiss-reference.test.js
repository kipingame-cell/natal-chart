// Independent numeric fixtures generated using pyswisseph/Moshier, not this engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.Astronomy = require('../public/vendor/astronomy.js');
const { computePoints } = await import('../public/js/astro/core.js');
const { houses, houseOf, isDayChart } = await import('../public/js/astro/houses.js');
const { cases } = JSON.parse(fs.readFileSync(new URL('./swiss-reference.json', import.meta.url)));
const distance = (a,b) => Math.abs(((a-b)%360+540)%360-180);
for (const row of cases) test(`Swiss reference JD=${row.jd}, latitude=${row.lat}`, () => {
  const pts = computePoints(row.jd);
  const h = houses(row.jd, row.lat, row.lon);
  assert.equal(h.system, row.system);
  for (const key of ['asc','mc','vertex']) assert.ok(distance(h[key],row[key]) < .005, key);
  for (let i=1;i<=12;i++) assert.ok(distance(h.cusps[i],row.cusps[i]) < .005, 'cusp '+i);
  const spans=h.cusps.slice(1).map((c,i)=>((h.cusps[i===11?1:i+2]-c)%360+360)%360);
  assert.ok(Math.abs(spans.reduce((a,b)=>a+b,0)-360)<1e-6,'ordered house cycle');
  for (const [id, ref] of Object.entries(row.points)) {
    const p=pts.find(p=>p.id===id);
    assert.ok(distance(p.lon,ref.lon)<.025, `${id} longitude ${p.lon} vs ${ref.lon}`);
    const tolerance=id==='NorthNode'?.012:.001;
    assert.ok(Math.abs(p.speed-ref.speed)<tolerance,`${id} speed`);
    if(Math.abs(ref.speed)>tolerance) assert.equal(p.retro,ref.speed<0,`${id} retrograde`);
  }
});
test('polar day/night uses solar altitude, and poles are rejected', () => {
  const jd=2461200;
  const sun={lon:90,lat:0};const h=houses(jd,80,0);
  assert.equal(isDayChart(sun.lon,sun.lat,h,80),true);
  assert.equal(isDayChart(270,0,h,80),false);
  assert.throws(()=>houses(jd,90,0));assert.throws(()=>houses(jd,-90,0));
  for(let i=1;i<=12;i++) assert.equal(houseOf((h.cusps[i]+.01)%360,h.cusps),i);
});
