// IANA rules from the browser/Android ICU time-zone database, for the birth date.
// Ambiguous and nonexistent local times require an explicit manual UTC offset.
export function resolveLocalTime(y, m, d, hh, mm, zone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', { timeZone: zone, calendar: 'gregory',
      numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  } catch { throw new Error('Неизвестный часовой пояс IANA. Выберите город или укажите UTC вручную.'); }
  const local = Date.UTC(y, m - 1, d, hh, mm);
  const wall = ms => {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map(p => [p.type, p.value]));
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
  };
  const offsets = new Set();
  for (let h = -36; h <= 36; h += 6) {
    const ms = local + h * 3600000;
    offsets.add(wall(ms) - ms);
  }
  const candidates = [...offsets].map(offset => local - offset).filter(ms => wall(ms) === local);
  if (!candidates.length) throw new Error('Это местное время пропущено при переводе часов. Проверьте время или задайте UTC вручную.');
  if (candidates.length > 1) throw new Error('Это время встречается дважды при переводе часов. Отключите авто и задайте нужный UTC вручную.');
  return { timestamp: candidates[0], utc: (local - candidates[0]) / 3600000, timeZone: zone };
}
