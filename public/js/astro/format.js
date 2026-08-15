// Форматирование: знаки, глифы, градусы.
export const SIGNS = [
  { id: 0, name: 'Овен', gen: 'Овна', prep: 'Овне', glyph: '♈', element: 'fire' },
  { id: 1, name: 'Телец', gen: 'Тельца', prep: 'Тельце', glyph: '♉', element: 'earth' },
  { id: 2, name: 'Близнецы', gen: 'Близнецов', prep: 'Близнецах', glyph: '♊', element: 'air' },
  { id: 3, name: 'Рак', gen: 'Рака', prep: 'Раке', glyph: '♋', element: 'water' },
  { id: 4, name: 'Лев', gen: 'Льва', prep: 'Льве', glyph: '♌', element: 'fire' },
  { id: 5, name: 'Дева', gen: 'Девы', prep: 'Деве', glyph: '♍', element: 'earth' },
  { id: 6, name: 'Весы', gen: 'Весов', prep: 'Весах', glyph: '♎', element: 'air' },
  { id: 7, name: 'Скорпион', gen: 'Скорпиона', prep: 'Скорпионе', glyph: '♏', element: 'water' },
  { id: 8, name: 'Стрелец', gen: 'Стрельца', prep: 'Стрельце', glyph: '♐', element: 'fire' },
  { id: 9, name: 'Козерог', gen: 'Козерога', prep: 'Козероге', glyph: '♑', element: 'earth' },
  { id: 10, name: 'Водолей', gen: 'Водолея', prep: 'Водолее', glyph: '♒', element: 'air' },
  { id: 11, name: 'Рыбы', gen: 'Рыб', prep: 'Рыбах', glyph: '♓', element: 'water' },
];

export const PLANETS = {
  Sun: { name: 'Солнце', glyph: '☉', color: '#ffd166' },
  Moon: { name: 'Луна', glyph: '☽', color: '#c9d4ff' },
  Mercury: { name: 'Меркурий', glyph: '☿', color: '#4fd1c5' },
  Venus: { name: 'Венера', glyph: '♀', color: '#ff9ecb' },
  Mars: { name: 'Марс', glyph: '♂', color: '#ff6b6b' },
  Jupiter: { name: 'Юпитер', glyph: '♃', color: '#ffb347' },
  Saturn: { name: 'Сатурн', glyph: '♄', color: '#9aa0c3' },
  Uranus: { name: 'Уран', glyph: '♅', color: '#7de3f0' },
  Neptune: { name: 'Нептун', glyph: '♆', color: '#8f7bff' },
  Pluto: { name: 'Плутон', glyph: '♇', color: '#d18fff' },
  Chiron: { name: 'Хирон', glyph: '⚷', color: '#5ce8a0' },
  NorthNode: { name: 'Северный узел', glyph: '☊', color: '#ffd166' },
  SouthNode: { name: 'Южный узел', glyph: '☋', color: '#9aa0c3' },
  Selena: { name: 'Селена (Белая Луна)', glyph: '⚪', color: '#eceefb' },
  Lilith: { name: 'Лилит (Чёрная Луна)', glyph: '⚫', color: '#8a8fa8' },
  ParsFortuna: { name: 'Парс Фортуны', glyph: '⊗', color: '#ffd166' },
  Vertex: { name: 'Вертекс', glyph: 'Vx', color: '#ff7d9c' },
  ASC: { name: 'Асцендент (ASC)', glyph: 'ASC', color: '#5ce8a0' },
  MC: { name: 'Середина неба (MC)', glyph: 'MC', color: '#ffb347' },
};

export function signOf(lon) {
  const l = ((lon % 360) + 360) % 360;
  return SIGNS[Math.floor(l / 30)];
}

export function fmtDeg(lon, withSeconds = true) {
  const l = ((lon % 360) + 360) % 360;
  const s = signOf(l);
  const inSign = l % 30;
  const d = Math.floor(inSign);
  const mFull = (inSign - d) * 60;
  const m = Math.floor(mFull);
  const sec = Math.round((mFull - m) * 60);
  const secStr = withSeconds ? `${String(sec).padStart(2, '0')}″` : '';
  return { sign: s, text: `${s.glyph} ${s.name} ${d}°${String(m).padStart(2, '0')}′${secStr}` };
}

export const ELEMENT_NAMES = { fire: 'Огонь', earth: 'Земля', air: 'Воздух', water: 'Вода' };
export const CROSS_NAMES = ['Кардинальный', 'Фиксированный', 'Мутабельный'];
