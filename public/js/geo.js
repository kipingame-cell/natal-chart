// Геокодинг: встроенная база городов + Nominatim (OpenStreetMap) как резерв.
import { CITIES } from './data/cities.js';

export function searchLocalCities(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  return CITIES
    .filter(c => c[0].toLowerCase().includes(q))
    .slice(0, limit)
    .map(([name, lat, lon, utc]) => ({ name, lat, lon, utc }));
}

// Nominatim: отправляет наружу только название города (дата/время не передаются)
export async function geocodeOnline(query) {
  const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=5&accept-language=ru&q=' + encodeURIComponent(query);
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error('geocode http ' + res.status);
  const arr = await res.json();
  return arr.map(r => ({
    name: r.display_name.split(',').slice(0, 2).join(','),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    utc: null, // сдвиг выбирает пользователь
  }));
}
