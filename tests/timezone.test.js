import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalTime } from '../public/js/astro/timezone.js';
import { CITIES, CITY_TIMEZONES } from '../public/js/data/cities.js';
import { fmtDeg } from '../public/js/astro/format.js';
for (const [date, zone, offset] of [
  [[2006,6,10,22,0], 'Europe/Moscow', 4],
  [[2006,1,10,22,0], 'Europe/Moscow', 3],
  [[2012,1,10,22,0], 'Europe/Moscow', 4],
  [[2026,6,10,22,0], 'Europe/Moscow', 3],
  [[2026,1,10,0,0], 'Asia/Kathmandu', 5.75],
  [[2026,1,10,0,0], 'America/St_Johns', -3.5],
  [[2026,6,10,0,0], 'Pacific/Chatham', 12.75],
  [[2026,6,10,0,0], 'Asia/Almaty', 5],
]) test(`historical UTC ${date} ${zone}`, () => {
  const result = resolveLocalTime(...date, zone);
  assert.equal(result.utc, offset);
  assert.equal(result.timestamp, Date.UTC(date[0], date[1]-1, date[2], date[3], date[4]) - offset*3600000);
});
test('DST gap and repeated hour need explicit UTC', () => {
  assert.throws(() => resolveLocalTime(2026,3,29,2,30,'Europe/Berlin'), /пропущено/);
  assert.throws(() => resolveLocalTime(2026,10,25,2,30,'Europe/Berlin'), /дважды/);
  assert.throws(() => resolveLocalTime(2026,1,1,0,0,'Invalid/Zone'), /Неизвестный/);
});
test('all offline cities have valid IANA zones', () => {
  for (const [name] of CITIES) {
    assert.ok(CITY_TIMEZONES[name], name);
    resolveLocalTime(2006,6,10,12,0,CITY_TIMEZONES[name]);
  }
});
test('seconds carry into minutes, degrees and next sign', () => {
  assert.match(fmtDeg(29.9999999).text, /Телец 0°00′00″/);
  assert.match(fmtDeg(359.9999999).text, /Овен 0°00′00″/);
  assert.match(fmtDeg(12+59/3600+0.6/3600).text, /12°01′00″/);
});
