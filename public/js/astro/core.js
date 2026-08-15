// Астро-ядро: положения планет и фиктивных точек.
// Эфемериды — Astronomy Engine (MIT, Don Cross), точность ±1 угл. минута.
// Селена/Лилит — средние линейные модели, откалиброванные по geocult (6 дат, 1995–2015).
// Хирон — кеплерово приближение по осцулирующим элементам JPL Horizons (эпоха 2006).

const DEG = Math.PI / 180;
const J2000 = 2451545.0;

// Юлианская дата от UTC-компонентов
export function julianDay(y, m, d, hourUT) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + hourUT / 24;
}

// Средняя наклонность эклиптики (градусы), Meeus
export function meanObliquity(jd) {
  const T = (jd - J2000) / 36525;
  return 23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T;
}

const norm360 = x => ((x % 360) + 360) % 360;
const sinD = x => Math.sin(x * DEG);
const cosD = x => Math.cos(x * DEG);
export { norm360 };

// --- Геоцентрическая эклиптическая долгота тела (эквинокс даты) ---
function geoEclLonLat(body, astroTime) {
  const v = Astronomy.GeoVector(body, astroTime, true); // aberration on
  const e = Astronomy.Ecliptic(v);
  return { lon: norm360(e.elon), lat: e.elat };
}

// Хирон: двухтельное приближение. Элементы JPL Horizons, эпоха JD 2453887.5 (J2000 ecliptic frame)
const CHIRON = { epoch: 2453887.5, a: 13.68961762266054, e: 0.3816261438396747, i: 6.934738209007098, Om: 209.2179094893366, w: 339.8329622241345, n: 0.01945884673687563, M0: 73.07558489990154 };
const EPS_J2000 = 23.4392911;

function keplerE(M, e) {
  M = M * DEG;
  let E = M;
  for (let k = 0; k < 30; k++) {
    const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E / DEG;
}

function chironHelio(jd) {
  const M = norm360(CHIRON.M0 + CHIRON.n * (jd - CHIRON.epoch));
  const E = keplerE(M, CHIRON.e) * DEG;
  const nu = 2 * Math.atan2(Math.sqrt(1 + CHIRON.e) * Math.sin(E / 2), Math.sqrt(1 - CHIRON.e) * Math.cos(E / 2));
  const r = CHIRON.a * (1 - CHIRON.e * Math.cos(E));
  // в плоскости орбиты -> эклиптика J2000
  const u = nu + CHIRON.w * DEG;
  const x = r * (Math.cos(CHIRON.Om * DEG) * Math.cos(u) - Math.sin(CHIRON.Om * DEG) * Math.sin(u) * Math.cos(CHIRON.i * DEG));
  const y = r * (Math.sin(CHIRON.Om * DEG) * Math.cos(u) + Math.cos(CHIRON.Om * DEG) * Math.sin(u) * Math.cos(CHIRON.i * DEG));
  const z = r * (Math.sin(u) * Math.sin(CHIRON.i * DEG));
  return { x, y, z };
}

// Земля (бариц. EMB — Солнце), экваториальный J2000 -> эклиптика J2000
function earthHelioEclJ2000(astroTime) {
  const v = Astronomy.HelioVector('Earth', astroTime);
  const c = Math.cos(EPS_J2000 * DEG), s = Math.sin(EPS_J2000 * DEG);
  return { x: v.x, y: v.y * c + v.z * s, z: -v.y * s + v.z * c };
}

function chironGeo(jd, astroTime) {
  const h = chironHelio(jd);
  const e = earthHelioEclJ2000(astroTime);
  const gx = h.x - e.x, gy = h.y - e.y, gz = h.z - e.z;
  let lon = Math.atan2(gy, gx) / DEG;
  const lat = Math.atan2(gz, Math.hypot(gx, gy)) / DEG;
  // приближённая прецессия J2000 -> эквинокс даты (~50.29"/год по долготе)
  lon += 50.29 * (jd - J2000) / 365.25 / 3600;
  return { lon: norm360(lon), lat };
}

// Средний восходящий узел (Meeus) + главные периодические члены истинного узла
function northNode(jd, sunLon) {
  const T = (jd - J2000) / 36525;
  const mean = norm360(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T * T * T / 467441 - T * T * T * T / 60616000);
  const tru = norm360(mean + 1.4979 * sinD(2 * (sunLon - mean)) + 0.15 * sinD(2 * sunLon));
  return { mean, true: tru };
}

// Лилит (средний лунный апогей + 180°): линейная модель, калибровка по geocult
// на 6 датах 1995–2015 (макс. ошибка 0.14°)
const LILITH = { l0: 263.34853967, jd0: J2000, rate: 0.111398014 };

// Селена (Белая Луна): линейная модель, период ровно 7 лет, калибровка по geocult
// на 6 датах 1995–2015 (макс. ошибка 0.02°)
const SELENA = { l0: 242.50256728, jd0: J2000, rate: 0.140823277 };

const BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

// Полный набор точек карты. Возвращает массив {id, name, lon, lat, speed, retro}
export function computePoints(jd) {
  const astroTime = Astronomy.MakeTime(new Date((jd - 2440587.5) * 86400000));
  const t1 = Astronomy.MakeTime(new Date((jd + 1 - 2440587.5) * 86400000));
  const pts = [];
  const lonAt = (body, tt) => body === 'Moon'
    ? norm360(Astronomy.EclipticGeoMoon(tt).lon)
    : geoEclLonLat(body, tt).lon;

  for (const b of BODIES) {
    const ll = b === 'Moon'
      ? { lon: norm360(Astronomy.EclipticGeoMoon(astroTime).lon), lat: Astronomy.EclipticGeoMoon(astroTime).lat }
      : geoEclLonLat(b, astroTime);
    const speed = norm360(lonAt(b, t1) - ll.lon + 180) - 180;
    pts.push({ id: b, lon: ll.lon, lat: ll.lat, speed, retro: speed < 0 });
  }

  // Хирон
  const ch = chironGeo(jd, astroTime);
  const ch1 = chironGeo(jd + 1, t1);
  const chSpeed = norm360(ch1.lon - ch.lon + 180) - 180;
  pts.push({ id: 'Chiron', lon: ch.lon, lat: ch.lat, speed: chSpeed, retro: chSpeed < 0, approx: true });

  const sunLon = pts[0].lon;
  // Узлы (истинный восходящий)
  const node = northNode(jd, sunLon);
  pts.push({ id: 'NorthNode', lon: node.true, lat: 0, speed: -0.053, retro: true, mean: node.mean });
  // Селена, Лилит
  pts.push({ id: 'Selena', lon: norm360(SELENA.l0 + SELENA.rate * (jd - SELENA.jd0)), lat: 0, speed: SELENA.rate, retro: false, mean: true });
  pts.push({ id: 'Lilith', lon: norm360(LILITH.l0 + LILITH.rate * (jd - LILITH.jd0)), lat: 0, speed: LILITH.rate, retro: false, mean: true });
  return pts;
}
