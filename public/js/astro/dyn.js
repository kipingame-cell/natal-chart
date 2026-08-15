// Астродины (упрощённая модель): относительная сила и гармония планет и домов.
// Это НЕ точная реплика системы geocult — честная упрощённая шкала:
// сила = эссенциальное достоинство + положение в доме + аспектная связанность;
// гармония = знак достоинства + взвешенные гармоничные/напряжённые аспекты.

const RULERS = [
  ['Mars'], ['Venus'], ['Mercury'], ['Moon'], ['Sun'], ['Mercury'],
  ['Venus'], ['Pluto', 'Mars'], ['Jupiter'], ['Saturn'], ['Uranus', 'Saturn'], ['Neptune', 'Jupiter'],
];
const EXALT = { Sun: 0, Moon: 1, Mercury: 5, Venus: 11, Mars: 9, Jupiter: 3, Saturn: 6, Uranus: 7, Neptune: 10, Pluto: 0 };
const FALL = { Sun: 6, Moon: 7, Mercury: 11, Venus: 5, Mars: 3, Jupiter: 9, Saturn: 0, Uranus: 1, Neptune: 4, Pluto: 6 };
const DETRIMENT = { Sun: [10], Moon: [9], Mercury: [8, 11], Venus: [0, 7], Mars: [1, 6], Jupiter: [2, 5], Saturn: [3, 4], Uranus: [4], Neptune: [5], Pluto: [1] };

export function dignity(planetId, signIdx) {
  if (RULERS[signIdx].includes(planetId)) return { score: 5, label: 'в обители' };
  if (EXALT[planetId] === signIdx) return { score: 4, label: 'в экзальтации' };
  if (DETRIMENT[planetId]?.includes(signIdx)) return { score: -5, label: 'в изгнании' };
  if (FALL[planetId] === signIdx) return { score: -4, label: 'в падении' };
  return { score: 0, label: 'перегрин' };
}

const HOUSE_W = { 1: 5, 10: 5, 7: 4, 4: 4, 11: 3, 5: 3, 9: 2, 3: 2, 2: 1, 8: 1, 6: 0, 12: -1 };

export function planetStrength(p, house, aspectsFor) {
  const d = dignity(p.id, Math.floor(p.lon / 30));
  let aspectPower = 0, harmony = d.score * 4;
  for (const a of aspectsFor) {
    const w = (a.aspect.orb * 2 - a.orb) / (a.aspect.orb * 2); // 0..1
    aspectPower += 1 + 3 * w;
    const mult = a.aspect.id === 'conjunction' ? 0.3 : a.aspect.nature;
    harmony += mult * (2 + 8 * w);
  }
  const force = Math.max(1, 25 + d.score * 5 + HOUSE_W[house] * 3 + aspectPower * 2);
  return { force: +force.toFixed(1), harmony: +harmony.toFixed(1), dignity: d };
}
