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
  const eps = meanObliquity(jd);
  const R = ramc(jd, lonEast);
  const mc = midheaven(R, eps);
  const asc = ascendant(R, lat, eps);
  const cusps = [null, asc];
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
  const vtx = ascendant(norm360(R + 180), 90 - lat, eps);
  return { cusps, asc, mc, vertex: vtx, eps, ramc: R };
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
export function parsFortunae(asc, sunLon, moonLon, sunHouse) {
  const day = sunHouse >= 7 && sunHouse <= 12;
  return norm360(day ? asc + moonLon - sunLon : asc + sunLon - moonLon);
}
