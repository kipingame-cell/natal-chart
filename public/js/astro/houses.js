// Дома Плацидуса, ASC, MC, Вертекс, Парс Фортуны.
import { meanObliquity, norm360 } from './core.js';

const DEG = Math.PI / 180;
const sinD = x => Math.sin(x * DEG), cosD = x => Math.cos(x * DEG), tanD = x => Math.tan(x * DEG);
const asinD = x => Math.asin(Math.max(-1, Math.min(1, x))) / DEG;
const atanD = x => Math.atan(x) / DEG;

// Локальное звёздное время (градусы RAMC)
export function ramc(jd, lonEast) {
  const date = new Date((jd - 2440587.5) * 86400000);
  const gstHours = Astronomy.SiderealTime(Astronomy.MakeTime(date)); // истинное звёздное время Гринвича, часы
  return norm360(gstHours * 15 + lonEast);
}

// MC по RAMC и наклону эклиптики
export function midheaven(ramcDeg, eps) {
  const mc = Math.atan2(sinD(ramcDeg), cosD(ramcDeg) * cosD(eps)) / DEG;
  return norm360(mc);
}

// Асцендент
export function ascendant(ramcDeg, lat, eps) {
  const y = cosD(ramcDeg);
  const x = -(sinD(ramcDeg) * cosD(eps) + tanD(lat) * sinD(eps));
  return norm360(Math.atan2(y, x) / DEG);
}

// Куспид промежуточного дома Плацидуса итерациями полудуг.
// num: 11,12,2,3 (остальные — оппозиции). f: доля полудуги (1/3 или 2/3).
function placidusCusp(num, ramcDeg, lat, eps) {
  // начальное приближение — равные 30° от MC/ASC
  const mc = midheaven(ramcDeg, eps);
  const offsets = { 11: 30, 12: 60, 2: 120, 3: 150 };
  const fracs = { 11: 1 / 3, 12: 2 / 3, 2: 2 / 3, 3: 1 / 3 }; // нижние: вычитаем долю NSA от IC
  let lon = norm360(mc + offsets[num]);
  const f = fracs[num];
  for (let i = 0; i < 60; i++) {
    // полудуга куспида
    const dec = asinD(sinD(eps) * sinD(lon));
    const ra = norm360(Math.atan2(sinD(lon) * cosD(eps), cosD(lon)) / DEG);
    const sda = asinD(tanD(dec) * tanD(lat)); // полуночная дуга
    let H;
    if (num === 11 || num === 12) {
      const dsa = 90 + sda; // дневная полудуга
      H = f * dsa;
      const raTarget = norm360(ramcDeg + H);
      let d = norm360(raTarget - ra + 180) - 180;
      if (Math.abs(d) < 1e-9) break;
      lon = norm360(lon + d);
    } else {
      const nsa = 90 - sda; // ночная полудуга
      H = f * nsa;
      const raTarget = norm360(ramcDeg + 180 - H);
      let d = norm360(raTarget - ra + 180) - 180;
      if (Math.abs(d) < 1e-9) break;
      lon = norm360(lon + d);
    }
  }
  return lon;
}

// Все 12 куспидов: возвращает {cusps[1..12], asc, mc, vertex}
export function houses(jd, lat, lonEast) {
  if (!Number.isFinite(jd) || !Number.isFinite(lat) || !Number.isFinite(lonEast) || Math.abs(lat) >= 90 || Math.abs(lonEast) > 180) throw new Error('Широта должна быть между −90 и +90°, долгота — от −180 до +180°');
  const time = Astronomy.MakeTime(new Date((jd - 2440587.5) * 86400000));
  const eps = Astronomy.e_tilt(time).tobl;
  const R = ramc(jd, lonEast);
  const mc = midheaven(R, eps);
  let asc = ascendant(R, lat, eps);
  // Select the eastern horizon intersection when the meridian is below it.
  if (Math.abs(lat) >= 90 - eps && norm360(asc - mc + 180) - 180 < 0) asc = norm360(asc + 180);
  const cusps = [null, asc];
  // Placidus has no solution beyond the polar circle; use a named whole-sign
  // system there instead of clamping an impossible semidiurnal arc.
  if (Math.abs(lat) >= 90 - eps) {
    const start = Math.floor(asc / 30) * 30;
    for (let i = 1; i <= 12; i++) cusps[i] = norm360(start + (i - 1) * 30);
    return { cusps, asc, mc, vertex: vertex(R, lat, eps), eps, ramc: R,
      system: 'Целые знаки', warning: 'За полярным кругом Плацидус не определён. Используются дома по целым знакам.' };
  }
  cusps[10] = mc;
  cusps[11] = placidusCusp(11, R, lat, eps);
  cusps[12] = placidusCusp(12, R, lat, eps);
  cusps[2] = placidusCusp(2, R, lat, eps);
  cusps[3] = placidusCusp(3, R, lat, eps);
  cusps[4] = norm360(mc + 180);
  cusps[5] = norm360(cusps[11] + 180);
  cusps[6] = norm360(cusps[12] + 180);
  cusps[7] = norm360(asc + 180);
  cusps[8] = norm360(cusps[2] + 180);
  cusps[9] = norm360(cusps[3] + 180);
  // Вертекс: асцендент для дополнительной широты, западная сторона
  const vtx = vertex(R, lat, eps);
  return { cusps, asc, mc, vertex: vtx, eps, ramc: R, system: 'Плацидус', warning: null };
}

// West intersection of the prime vertical with the ecliptic. The direct
// formula avoids tan(90-lat) at the equator and handles southern latitudes.
export function vertex(R, lat, eps) {
  let value = norm360(Math.atan2(sinD(lat) * cosD(R), cosD(lat) * sinD(eps) - sinD(lat) * sinD(R) * cosD(eps)) / DEG + (lat < 0 ? 0 : 180));
  // Choose the western intersection, also for observers inside the tropics.
  if (Math.abs(lat) <= eps && norm360(value - midheaven(R, eps) + 180) - 180 > 0) value = norm360(value + 180);
  return value;
}

// В каком доме точка (по долготе относительно куспидов, против часовой от 1-го)
export function houseOf(lon, cusps) {
  for (let h = 1; h <= 12; h++) {
    const c1 = cusps[h], c2 = cusps[h === 12 ? 1 : h + 1];
    const span = norm360(c2 - c1);
    const off = norm360(lon - c1);
    if (off < span) return h;
  }
  return 1;
}

// Парс Фортуны: день — ASC + Луна − Солнце, ночь — ASC + Солнце − Луна
export function parsFortunae(asc, sunLon, moonLon, sunHouse, isDay = null) {
  const day = isDay === null ? sunHouse >= 7 && sunHouse <= 12 : isDay;
  return norm360(day ? asc + moonLon - sunLon : asc + sunLon - moonLon);
}

// Geocentric altitude of the Sun's centre; no atmospheric refraction.
export function isDayChart(sunLon, sunLat, h, lat) {
  const x = cosD(sunLat) * cosD(sunLon);
  const y = cosD(sunLat) * sinD(sunLon) * cosD(h.eps) - sinD(sunLat) * sinD(h.eps);
  const z = cosD(sunLat) * sinD(sunLon) * sinD(h.eps) + sinD(sunLat) * cosD(h.eps);
  const ra = Math.atan2(y, x) / DEG;
  const dec = asinD(z);
  return sinD(lat) * sinD(dec) + cosD(lat) * cosD(dec) * cosD(h.ramc - ra) >= 0;
}
