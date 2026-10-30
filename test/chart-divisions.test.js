import test from 'node:test';
import assert from 'node:assert/strict';
import { divisionDefinitions, divisionalPosition, calculateDivisions } from '../public/chart-divisions.js';

test('the sixteen declared factors each expose their actual sign-allocation convention', () => {
  assert.deepEqual(divisionDefinitions.map(item => item.factor), [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60]);
  assert.equal(new Set(divisionDefinitions.map(item => item.id)).size, 16);
  for (const item of divisionDefinitions) assert.ok(item.label && item.description && item.convention);
  assert.match(divisionDefinitions.find(item => item.id === 'D60').convention, /From-natal-sign/);
  assert.match(divisionDefinitions.find(item => item.id === 'D30').description, /unequal/);
});

// Independently hand-worked rule-table examples at 13° within Aries, Taurus
// and Gemini exercise odd/even signs, all modalities and several elements.
// These expected allocations are fixed values, not a second copy of the code.
const workedExamples = [
  ['D1', [0, 1, 2]], ['D2', [4, 3, 4]], ['D3', [4, 5, 6]],
  ['D4', [3, 4, 5]], ['D7', [3, 10, 5]], ['D9', [3, 0, 9]],
  ['D10', [4, 1, 6]], ['D12', [5, 6, 7]], ['D16', [6, 10, 2]],
  ['D20', [8, 4, 0]], ['D24', [2, 1, 2]], ['D27', [11, 2, 5]],
  ['D30', [8, 11, 8]], ['D40', [5, 11, 5]], ['D45', [7, 11, 3]],
  ['D60', [2, 3, 4]],
];
test('classical worked examples distinguish parity and modality instead of using one harmonic formula', () => {
  for (const [id, expected] of workedExamples) {
    [13, 43, 73].forEach((longitude, index) => {
      assert.equal(divisionalPosition(longitude, id).signIndex, expected[index], `${id} at ${longitude}°`);
    });
  }
});

test('Sun/Moon Hora changes ownership at exactly 15 degrees in odd and even natal signs', () => {
  const cases = [[0, 'Leo'], [14.999999, 'Leo'], [15, 'Cancer'], [29.999999, 'Cancer'], [30, 'Cancer'], [44.999999, 'Cancer'], [45, 'Leo'], [59.999999, 'Leo']];
  for (const [longitude, sign] of cases) assert.equal(divisionalPosition(longitude, 'D2').sign, sign);
});

test('Trimsamsa uses the declared unequal odd/even segment boundaries', () => {
  const oddStarts = [[0, 'Aries'], [5, 'Aquarius'], [10, 'Sagittarius'], [18, 'Gemini'], [25, 'Libra']];
  const evenStarts = [[30, 'Taurus'], [35, 'Virgo'], [42, 'Pisces'], [50, 'Capricorn'], [55, 'Scorpio']];
  for (const cases of [oddStarts, evenStarts]) {
    cases.forEach(([longitude, sign], index) => {
      const position = divisionalPosition(longitude, 'D30');
      assert.equal(position.sign, sign);
      assert.equal(position.part, index + 1);
      assert.equal(position.partCount, 5);
      if (index) assert.equal(divisionalPosition(longitude - 1e-8, 'D30').sign, cases[index - 1][1]);
    });
  }
  assert.equal(divisionalPosition(24.9, 'D30').sign, 'Gemini');
  assert.equal(divisionalPosition(54.9, 'D30').sign, 'Capricorn');
});

test('fractional internal cusps remain stable after natal-sign subtraction without swallowing nearby values', () => {
  const d7Cusp = 30 + 30 / 7;
  assert.equal(divisionalPosition(d7Cusp - 1e-8, 'D7').sign, 'Scorpio');
  assert.equal(divisionalPosition(d7Cusp, 'D7').sign, 'Sagittarius');
  assert.equal(divisionalPosition(d7Cusp + 1e-8, 'D7').sign, 'Sagittarius');
  const d27Cusp = 330 + 30 / 27;
  assert.equal(divisionalPosition(d27Cusp - 1e-8, 'D27').sign, 'Capricorn');
  assert.equal(divisionalPosition(d27Cusp, 'D27').sign, 'Aquarius');
  // The last fraction of a natal sign remains in its final part.
  assert.equal(divisionalPosition(29.99999999999999, 'D60').sourceSignIndex, 0);
  assert.equal(divisionalPosition(29.99999999999999, 'D60').part, 60);
  assert.equal(divisionalPosition(30, 'D60').part, 1);
});

test('D60 explicitly counts from the natal sign rather than silently switching variants', () => {
  const cases = [[0, 'Aries'], [0.5, 'Taurus'], [29.999, 'Pisces'], [30, 'Taurus'], [30.5, 'Gemini'], [59.999, 'Aries'], [60, 'Gemini'], [330, 'Pisces']];
  for (const [longitude, sign] of cases) assert.equal(divisionalPosition(longitude, 'D60').sign, sign);
  assert.notEqual(divisionalPosition(30, 'D60').signIndex, Math.floor(30 * 60 / 30) % 12);
});

test('Navamsa agrees with the already independently referenced J2000 chart', () => {
  // Swiss/Moshier reference sidereal positions, also used in core-engine tests.
  assert.equal(divisionalPosition(100.1508650544 - 23.8532224860, 'D9').sign, 'Aquarius');
  assert.equal(divisionalPosition(280.3689196753 - 23.8532224860, 'D9').sign, 'Leo');
  assert.equal(divisionalPosition(223.3237754384 - 23.8532224860, 'D9').sign, 'Pisces');
});

test('each divisional chart uses its own ascendant for houses and preserves the natal record separately', () => {
  const planets = [
    { name: 'Sun', longitude: 280.3689196753 - 23.8532224860, degree: 16.5156971893, house: 7, retrograde: false, speedDegreesPerDay: 1.0194 },
    { name: 'Moon', longitude: 223.3237754384 - 23.8532224860, house: 5, retrograde: false },
  ];
  const original = structuredClone(planets);
  const divisions = calculateDivisions(100.1508650544 - 23.8532224860, planets);
  assert.equal(Object.keys(divisions).length, 16);
  assert.equal(divisions.D1.ascendant.sign, 'Gemini');
  assert.equal(divisions.D9.ascendant.sign, 'Aquarius');
  assert.equal(divisions.D9.planets[0].sign, 'Leo');
  assert.equal(divisions.D9.planets[0].house, 7);
  assert.equal(divisions.D9.planets[1].house, 2);
  assert.equal(divisions.D9.planets[0].speedDegreesPerDay, 1.0194);
  assert.equal(divisions.D9.planets[0].natal.degree, planets[0].degree);
  assert.equal(Object.hasOwn(divisions.D9.planets[0], 'degree'), false);
  assert.equal(Object.hasOwn(divisions.D9.planets[0], 'nakshatra'), false);
  assert.deepEqual(planets, original);
  for (const result of Object.values(divisions)) {
    assert.equal(result.planets.length, planets.length);
    result.planets.forEach(planet => assert.ok(planet.house >= 1 && planet.house <= 12));
  }
});

test('finite angles normalize through the zodiac while malformed inputs and duplicate bodies are rejected', () => {
  for (const id of divisionDefinitions.map(item => item.id)) {
    assert.deepEqual(divisionalPosition(360, id), divisionalPosition(0, id));
    assert.deepEqual(divisionalPosition(-1, id), divisionalPosition(359, id));
    assert.deepEqual(divisionalPosition(-360, id), divisionalPosition(0, id));
  }
  assert.equal(divisionalPosition(-1e-15, 'D1').sign, 'Pisces');
  assert.equal(divisionalPosition(-1e-15, 'D1').sourceSignIndex, 11);
  assert.ok(divisionalPosition(-1e-15, 'D1').sourceLongitude < 360);
  for (const value of [NaN, Infinity, -Infinity, '13', null, undefined]) assert.throws(() => divisionalPosition(value, 'D9'), /finite numeric/);
  assert.throws(() => divisionalPosition(13, 'D5'), /supported divisional/);
  assert.throws(() => calculateDivisions(13, []), /require planetary/);
  assert.throws(() => calculateDivisions(13, [{ name: 'Sun', longitude: 13 }, { name: 'Sun', longitude: 50 }]), /distinct name/);
  assert.throws(() => calculateDivisions(13, [{ name: 'Sun', longitude: NaN }]), /finite numeric/);
  assert.throws(() => calculateDivisions(13, [null]), /distinct name/);
});
