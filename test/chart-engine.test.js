import test from 'node:test';
import assert from 'node:assert/strict';
import * as Astronomy from '../public/vendor/astronomy-engine.js';
import { calculateChart, calculateDashas, calculatePanchang, localToUtc, wholeSignHouse, normalizeDegrees, tropicalLongitude, meanNodeLongitude, trueNodeLongitude, lahiriAyanamsa, ascendantLongitude, calculationVersion } from '../public/chart-engine.js';

const YEAR_MS = 365.25 * 86400000;
const angularDistance = (a, b) => Math.abs(normalizeDegrees(a - b + 180) - 180);

test('civil time uses the birth-date timezone, including summer/winter and historical offsets', () => {
  assert.equal(localToUtc('2000-01-01', '17:30', 'Asia/Kolkata').toISOString(), '2000-01-01T12:00:00.000Z');
  assert.equal(localToUtc('2024-07-01', '12:00', 'America/New_York').toISOString(), '2024-07-01T16:00:00.000Z');
  assert.equal(localToUtc('2024-01-01', '12:00', 'America/New_York').toISOString(), '2024-01-01T17:00:00.000Z');
  assert.equal(localToUtc('2024-07-01', '12:00', 'Europe/London').toISOString(), '2024-07-01T11:00:00.000Z');
  assert.equal(localToUtc('2024-01-01', '12:00', 'Australia/Sydney').toISOString(), '2024-01-01T01:00:00.000Z');
  // British India's wartime UTC+06:30 must not silently become modern UTC+05:30.
  assert.equal(localToUtc('1943-01-01', '12:00', 'Asia/Kolkata').toISOString(), '1943-01-01T05:30:00.000Z');
});

test('DST gaps and ambiguous repeated times are rejected rather than guessed', () => {
  assert.throws(() => localToUtc('2024-03-10', '02:30', 'America/New_York'), /did not exist/);
  assert.throws(() => localToUtc('2024-11-03', '01:30', 'America/New_York'), /occurred twice/);
  assert.throws(() => localToUtc('2024-03-31', '01:30', 'Europe/London'), /did not exist/);
});

test('birth seconds survive modern and historical civil timezone conversion', () => {
  assert.equal(localToUtc('2000-01-01', '17:30:45', 'Asia/Kolkata').toISOString(), '2000-01-01T12:00:45.000Z');
  assert.equal(localToUtc('1943-01-01', '12:00:30', 'Asia/Kolkata').toISOString(), '1943-01-01T05:30:30.000Z');
  // Kolkata mean time before 1906 includes seconds (UTC+05:21:10).
  assert.equal(localToUtc('1900-01-01', '12:00:00', 'Asia/Kolkata').toISOString(), '1900-01-01T06:38:50.000Z');
  for (const time of ['12:00:60', '12:00:99', '12:00:0', '12:00:00.5', '1:00:00']) assert.throws(() => localToUtc('2000-01-01', time, 'Asia/Kolkata'));
  for (const timezone of [undefined, '', 'Invalid/Timezone']) assert.throws(() => localToUtc('2000-01-01', '12:00', timezone), /timezone/);
});

test('manual coordinates use the exact place and birth seconds without substituting a listed city', () => {
  const input = { date: '2000-01-01', time: '17:30:45', now: new Date('2026-10-29') };
  const listed = calculateChart({ ...input, cityId: 'jalandhar' });
  const custom = calculateChart({ ...input, location: { name: '  Birth hospital, Jalandhar  ', lat: 31.326, lon: 75.5762, timeZone: 'Asia/Kolkata' } });
  assert.equal(custom.city.id, 'custom-india');
  assert.equal(custom.city.name, 'Birth hospital, Jalandhar');
  assert.equal(custom.city.source, 'manual');
  assert.match(custom.settings.location, /not geocoded/);
  assert.equal(custom.utc, '2000-01-01T12:00:45.000Z');
  assert.equal(custom.ascendant.longitude, listed.ascendant.longitude);
  assert.deepEqual(custom.planets, listed.planets);
  assert.deepEqual(custom.panchang, listed.panchang);
});

test('manual Indian location inputs reject ambiguous, non-finite, out-of-range, and wrong-timezone coordinates', () => {
  const birth = { date: '2000-01-01', time: '12:00' };
  const valid = { name: 'Birth place', lat: 20, lon: 80, timeZone: 'Asia/Kolkata' };
  assert.throws(() => calculateChart({ ...birth, cityId: 'jalandhar', location: valid }), /one birth location/);
  for (const location of [null, [], {}, { ...valid, name: '' }, { ...valid, name: 'x' }, { ...valid, name: 'a'.repeat(161) }, { ...valid, name: 'A\nB' }, { ...valid, lat: '20' }, { ...valid, lat: NaN }, { ...valid, lat: Infinity }, { ...valid, lon: undefined }, { ...valid, lat: 5.999 }, { ...valid, lat: 38.001 }, { ...valid, lon: 67.999 }, { ...valid, lon: 98.001 }, { ...valid, timeZone: 'UTC' }, { ...valid, timeZone: undefined }]) {
    assert.throws(() => calculateChart({ ...birth, location }), `Rejected ${JSON.stringify(location)}`);
  }
  const south = calculateChart({ ...birth, location: { ...valid, lat: 6.8, lon: 93.7, name: 'Great Nicobar' } });
  const north = calculateChart({ ...birth, location: { ...valid, lat: 34.15, lon: 77.57, name: 'Leh' } });
  assert.equal(south.city.lat, 6.8);
  assert.equal(north.city.lat, 34.15);
  assert.ok(angularDistance(south.ascendant.longitude, north.ascendant.longitude) > 1);
});

test('invalid dates and unrecognized cities cannot produce a default Jalandhar chart', () => {
  for (const [date, time] of [['2023-02-29', '12:00'], ['2024-13-01', '12:00'], ['2024-01-01', '24:00'], ['1899-12-31', '12:00'], ['2101-01-01', '12:00']]) {
    assert.throws(() => localToUtc(date, time, 'Asia/Kolkata'));
  }
  assert.throws(() => calculateChart({ date: '2000-01-01', time: '12:00', cityId: 'missing' }), /supported birth city/);
  assert.equal(localToUtc('2024-02-29', '12:00', 'Asia/Kolkata').toISOString(), '2024-02-29T06:30:00.000Z');
});

test('whole-sign houses depend on sign, not degrees within the ascendant sign', () => {
  assert.equal(wholeSignHouse(11, 20), 1);
  assert.equal(wholeSignHouse(29.999, 0), 1);
  assert.equal(wholeSignHouse(30, 20), 2);
  assert.equal(wholeSignHouse(359.999, 20), 12);
  assert.equal(wholeSignHouse(0, 359), 2);
});

test('first partial mahadasha preserves the elapsed portion and covers 120 birth years', () => {
  const birth = new Date('2000-01-01T12:00:00Z');
  // Half-way through Ashwini: Ketu's 7-year period has 3.5 years left.
  const periods = calculateDashas(birth, 20 / 3, new Date(birth.getTime() + YEAR_MS));
  assert.equal(periods[0].planet, 'Ketu');
  assert.ok(Math.abs(periods[0].years - 3.5) < 1e-10);
  assert.ok(Math.abs(new Date(periods[0].end).getTime() - birth.getTime() - 3.5 * YEAR_MS) <= 1);
  assert.ok(Math.abs(new Date(periods[0].fullStart).getTime() - birth.getTime() + 3.5 * YEAR_MS) <= 1);
  assert.equal(periods[1].planet, 'Venus');
  assert.ok(Math.abs(periods[1].years - 20) < 1e-10);
  assert.equal(new Date(periods.at(-1).end).getTime(), birth.getTime() + 120 * YEAR_MS);
  assert.equal(periods.filter((p) => p.isCurrent).length, 1);
  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    if (i) assert.equal(period.start, periods[i - 1].end);
    assert.equal(period.antardashas[0].start, period.start);
    assert.equal(period.antardashas.at(-1).end, period.end);
    for (let j = 1; j < period.antardashas.length; j++) assert.equal(period.antardashas[j].start, period.antardashas[j - 1].end);
  }
});

test('antardashas derive from full mahadasha start, not the clipped birth date', () => {
  const birth = new Date('2000-01-01T12:00:00Z');
  const p = calculateDashas(birth, 20 / 3, birth)[0];
  // The halfway point of Ketu mahadasha is inside Rahu antardasha.
  assert.equal(p.antardashas[0].planet, 'Rahu');
  assert.equal(p.antardashas[0].isCurrent, true);
});

test('pratyantardashas preserve the full antardasha origin when birth clips the parent', () => {
  const birth = new Date('2000-01-01T12:00:00Z');
  const major = calculateDashas(birth, 20 / 3, birth)[0];
  const sub = major.antardashas[0];
  assert.equal(sub.planet, 'Rahu');
  // Half-way through Ketu mahadasha is inside Rahu/Mercury, not Rahu/Rahu.
  // The remaining Mercury portion is 7/240 of a dasha year from birth.
  assert.equal(sub.pratyantardashas[0].planet, 'Mercury');
  assert.equal(sub.pratyantardashas[0].start, birth.toISOString());
  assert.equal(sub.pratyantardashas[0].isCurrent, true);
  assert.ok(Math.abs(new Date(sub.pratyantardashas[0].end).getTime() - birth.getTime() - 7 / 240 * YEAR_MS) < 1);
  assert.ok(new Date(sub.fullStart) < birth);
  assert.ok(new Date(sub.pratyantardashas[0].fullStart) < birth);
});

test('365.25-day and 360-day dasha years change actual timing and all three levels close their parents', () => {
  const birth = new Date('2000-01-01T12:00:00Z');
  for (const yearDays of [365.25, 360]) {
    const yearMs = yearDays * 86400000;
    for (const moon of [0, 20 / 3, 359.99999]) {
      const periods = calculateDashas(birth, moon, new Date(+birth + yearMs), { yearDays });
      assert.equal(new Date(periods.at(-1).end).getTime(), +birth + 120 * yearMs);
      const thirdLevelCurrent = [];
      for (const period of periods) {
        assert.equal(period.antardashas[0].start, period.start);
        assert.equal(period.antardashas.at(-1).end, period.end);
        for (let i = 0; i < period.antardashas.length; i++) {
          const sub = period.antardashas[i];
          if (i) assert.equal(sub.start, period.antardashas[i - 1].end);
          assert.equal(sub.pratyantardashas[0].start, sub.start);
          assert.equal(sub.pratyantardashas.at(-1).end, sub.end);
          for (let j = 0; j < sub.pratyantardashas.length; j++) {
            const third = sub.pratyantardashas[j];
            if (j) assert.equal(third.start, sub.pratyantardashas[j - 1].end);
            assert.ok(new Date(third.start) >= new Date(sub.start));
            assert.ok(new Date(third.end) <= new Date(sub.end));
            if (third.isCurrent) thirdLevelCurrent.push(third);
          }
        }
      }
      assert.equal(thirdLevelCurrent.length, 1);
    }
    const first = calculateDashas(birth, 0, birth, { yearDays })[0];
    assert.equal(new Date(first.end).getTime(), +birth + 7 * yearMs);
  }
  for (const options of [{ yearDays: 365 }, { yearDays: '360' }, { depth: 0 }, { depth: 4 }, { depth: 2.5 }]) assert.throws(() => calculateDashas(birth, 0, birth, options), /dasha year or depth/);
  assert.equal(calculateDashas(birth, 0, birth, { depth: 1 })[0].antardashas.length, 0);
  assert.equal(calculateDashas(birth, 0, birth, { depth: 2 })[0].antardashas[0].pratyantardashas, undefined);
});

test('calculation settings are explicit, versioned, and reject unsupported conventions', () => {
  const input = { date: '2000-01-01', time: '17:30:45', cityId: 'jalandhar', now: new Date('2026-10-29') };
  const defaults = calculateChart(input);
  const explicit = calculateChart({ ...input, settings: { node: 'mean', ayanamsa: 'lahiri', dashaYearDays: 365.25 } });
  assert.deepEqual(explicit, defaults);
  assert.equal(defaults.calculationVersion, calculationVersion);
  assert.equal(defaults.settings.calculationVersion, calculationVersion);
  assert.equal(defaults.settings.birthTimeResolutionSeconds, 1);
  assert.equal(calculateChart({ ...input, time: '17:30' }).settings.birthTimeResolutionSeconds, 60);
  for (const settings of [null, [], false, { node: 'missing' }, { ayanamsa: 'raman' }, { dashaYearDays: '360' }, { dashaYearDays: 365 }, { houses: 'placidus' }]) assert.throws(() => calculateChart({ ...input, settings }));
  const shorter = calculateChart({ ...input, settings: { dashaYearDays: 360 } });
  assert.equal(shorter.settings.dashaYearDays, 360);
  assert.notEqual(shorter.dashas[0].end, defaults.dashas[0].end);
  assert.deepEqual(shorter.planets, defaults.planets);
});

// Fixed independent Swiss Ephemeris 2.10.03 / pyswisseph 2.10.3.2 values,
// FLG_MOSEPH|FLG_SPEED; SIDM_LAHIRI for apparent-frame ayanamsa. A development
// audit used 2,412 monthly samples spanning 1900–2100; fixtures include its worst
// observed node error and near-station cases. Swiss code is not shipped.
const trueNodeReferences = [
  ['1900-01-01T12:00:00Z', 260.2569319254726, -0.025772868947155785, 22.465415972037224],
  ['1905-10-05T11:10:00Z', 149.44303783866744, -0.00017032883268272724, 22.538179947396927],
  ['2000-01-01T12:00:00Z', 123.95289541307294, -0.054382186675331005, 23.853222486029065],
  ['2006-09-18T15:57:00Z', 355.37513223198704, 0.005841381267831899, 23.951366761982754],
  ['2007-04-11T15:52:00Z', 345.5819497220099, 0.024780670606433207, 23.959817882383],
  ['2025-04-08T18:00:00Z', 357.3567302120499, 0.025901567414556615, 24.210281726059048],
  ['2026-11-25T12:23:00Z', 324.2453021413096, -0.17752522940979046, 24.23521238554267],
  ['2029-03-26T13:39:00Z', 279.8164609874011, -0.07671370784247396, 24.27017149948146],
  ['2046-03-16T06:39:00Z', 312.696463521708, 0.015623267980368722, 24.506185225574164],
  ['2100-01-01T12:00:00Z', 349.82727829585696, -0.008966058846319574, 25.255196368802743],
];
test('approximate osculating true node and apparent Lahiri match independent 1900–2100 fixtures', () => {
  const difference = (a, b) => normalizeDegrees(a - b + 180) - 180;
  for (const [iso, node, speed, ayanamsa] of trueNodeReferences) {
    const date = new Date(iso);
    assert.ok(angularDistance(trueNodeLongitude(date), node) < 0.016, `True node at ${iso}`);
    const modeledSpeed = difference(trueNodeLongitude(new Date(+date + 300000)), trueNodeLongitude(new Date(+date - 300000))) * 144;
    assert.ok(Math.abs(modeledSpeed - speed) < 0.015, `Node motion at ${iso}`);
    assert.ok(Math.abs(lahiriAyanamsa(date) - ayanamsa) < 0.0001, `Lahiri at ${iso}`);
  }
});

test('true node is opt-in, remains opposite Ketu, supports direct motion, and marks uncertain stations', () => {
  const input = { date: '2025-04-08', time: '23:30', cityId: 'jalandhar' };
  const mean = calculateChart(input);
  const trueNode = calculateChart({ ...input, settings: { node: 'true' } });
  assert.equal(mean.settings.nodeMode, 'mean');
  assert.equal(trueNode.settings.nodeMode, 'true');
  assert.match(trueNode.settings.node, /Approximate osculating/);
  const rahu = trueNode.planets.find(p => p.name === 'Rahu');
  const ketu = trueNode.planets.find(p => p.name === 'Ketu');
  assert.ok(angularDistance(rahu.tropicalLongitude, 357.3567302120499) < 0.016);
  assert.ok(angularDistance(rahu.longitude + 180, ketu.longitude) < 1e-9);
  assert.equal(rahu.retrograde, false);
  assert.equal(rahu.motionUncertain, false);
  assert.deepEqual(trueNode.planets.slice(0, 7), mean.planets.slice(0, 7));
  assert.deepEqual(trueNode.dashas, mean.dashas);
  const station = calculateChart({ date: '2100-01-01', time: '17:30', cityId: 'jalandhar', settings: { node: 'true' } }).planets.find(p => p.name === 'Rahu');
  assert.equal(station.motionUncertain, true);
  assert.equal(mean.planets.find(p => p.name === 'Rahu').motionUncertain, false);
});

test('retrograde uses geocentric motion and detects known Mercury and Mars retrogrades', () => {
  const mercury = calculateChart({ date: '2024-04-08', time: '12:00', cityId: 'delhi' }).planets.find((p) => p.name === 'Mercury');
  const mars = calculateChart({ date: '2023-01-01', time: '12:00', cityId: 'delhi' }).planets.find((p) => p.name === 'Mars');
  const direct = calculateChart({ date: '2024-06-01', time: '12:00', cityId: 'delhi' }).planets.find((p) => p.name === 'Mercury');
  assert.equal(mercury.retrograde, true);
  assert.equal(mars.retrograde, true);
  assert.equal(direct.retrograde, false);
});

test('birth-instant planetary speeds match independent Swiss references close to a Mercury station', () => {
  // pyswisseph 2.10.3.2 / Swiss Ephemeris 2.10.03, Moshier apparent geocentric.
  // These instants straddle Mercury's April 2024 direct-to-retrograde station.
  for (const [date, time, expected, retrograde] of [['2024-04-02', '03:30', 0.0011957902702398652, false], ['2024-04-02', '05:30', -0.008642886757567133, true]]) {
    const mercury = calculateChart({ date, time, cityId: 'delhi' }).planets.find(p => p.name === 'Mercury');
    assert.ok(Math.abs(mercury.speedDegreesPerDay - expected) < 0.001);
    assert.equal(mercury.retrograde, retrograde);
  }
});

test('Panchang follows lunar boundaries, fixed and repeating karanas, and the local civil weekday', () => {
  const date = new Date('2024-04-08T20:00:00Z'); // Tuesday in India; Monday in UTC.
  const cases = [
    [0, 1, 'Pratipada', 'Shukla', 'Kimstughna'],
    [6, 1, 'Pratipada', 'Shukla', 'Bava'],
    [12, 2, 'Dvitiya', 'Shukla', 'Balava'],
    [168, 15, 'Purnima', 'Shukla', 'Vishti'],
    [180, 16, 'Pratipada', 'Krishna', 'Balava'],
    [342, 29, 'Chaturdashi', 'Krishna', 'Shakuni'],
    [348, 30, 'Amavasya', 'Krishna', 'Chatushpada'],
    [354, 30, 'Amavasya', 'Krishna', 'Naga'],
    [359.999, 30, 'Amavasya', 'Krishna', 'Naga'],
    [360, 1, 'Pratipada', 'Shukla', 'Kimstughna'],
  ];
  for (const [moon, number, name, paksha, karana] of cases) {
    const p = calculatePanchang(0, moon, date, 'Asia/Kolkata');
    assert.deepEqual([p.tithi.number, p.tithi.name, p.tithi.paksha, p.karana.name], [number, name, paksha, karana]);
    assert.deepEqual(p.weekday, { number: 2, name: 'Tuesday', convention: 'Local civil day, midnight-based' });
  }
  assert.equal(calculatePanchang(350, 20, date, 'Asia/Kolkata').yoga.name, 'Vishkambha');
  assert.equal(calculatePanchang(0, 40 / 3, date, 'Asia/Kolkata').yoga.name, 'Priti');
  assert.equal(calculatePanchang(0, 359.999, date, 'Asia/Kolkata').yoga.name, 'Vaidhriti');
});

test('chart includes nine Vedic bodies, matching D9 classifications and mean-node opposition', () => {
  const chart = calculateChart({ date: '2000-01-01', time: '17:30', cityId: 'jalandhar', now: new Date('2026-10-29') });
  assert.equal(chart.utc, '2000-01-01T12:00:00.000Z');
  assert.equal(chart.planets.length, 9);
  assert.equal(chart.settings.node, 'Mean lunar node');
  assert.equal(chart.settings.houses, 'Whole sign');
  assert.equal(chart.ascendant.navamsaSign, 'Aquarius');
  assert.equal(chart.planets.find((p) => p.name === 'Sun').navamsaSign, 'Leo');
  assert.equal(chart.planets.find((p) => p.name === 'Moon').navamsaSign, 'Pisces');
  for (const p of chart.planets) {
    assert.ok(Number.isFinite(p.longitude));
    assert.ok(p.house >= 1 && p.house <= 12);
    assert.ok(p.pada >= 1 && p.pada <= 4);
  }
  assert.ok(angularDistance(chart.planets[7].longitude + 180, chart.planets[8].longitude) < 1e-9);
});

// Independent fixtures produced with pyswisseph 2.10.3.2, Swiss Ephemeris 2.10.03,
// FLG_MOSEPH | FLG_SPEED (apparent geocentric, true ecliptic of date), Lahiri mode.
// Reference library ran only in /tmp; it is not shipped or required by this app.
// Tolerances are intentional: Astronomy Engine + approximate Lahiri are not Swiss.
const referenceFixtures = [
  {
    utc: '2000-01-01T12:00:00Z', lat: 31.326, lon: 75.5762,
    tropical: { Sun: 280.3689196753, Moon: 223.3237754384, Mercury: 271.8892750075, Venus: 241.5657983262, Mars: 327.9633133185, Jupiter: 25.2530303094, Saturn: 40.3956389560 },
    meanNode: 125.0406460566, trueLahiri: 23.8532224860, tropicalAscendant: 100.1508650544,
  },
  {
    utc: '2024-04-08T18:00:00Z', lat: 28.6139, lon: 77.209,
    tropical: { Sun: 19.3862080768, Moon: 19.1826740318, Mercury: 24.8070936692, Venus: 4.4272157507, Mars: 343.0401714133, Jupiter: 49.0425974351, Saturn: 344.4537211287 },
    meanNode: 15.6477298836, trueLahiri: 24.1946395225, tropicalAscendant: 261.8951143844,
  },
];
for (const reference of referenceFixtures) {
  test(`numerical astronomy agrees with independent Swiss/Moshier fixture ${reference.utc}`, () => {
    const date = new Date(reference.utc);
    for (const [body, longitude] of Object.entries(reference.tropical)) {
      assert.ok(angularDistance(tropicalLongitude(body, date), longitude) < 0.01, `${body} exceeded 0.01 degree tolerance`);
    }
    assert.ok(angularDistance(meanNodeLongitude(date), reference.meanNode) < 0.001);
    assert.ok(Math.abs(lahiriAyanamsa(date) - reference.trueLahiri) < 0.001);
    assert.ok(angularDistance(ascendantLongitude(date, reference.lat, reference.lon), reference.tropicalAscendant) < 0.001);
  });
}

// Additional independent Moshier/Lahiri fixtures cover distant Indian regions,
// exact seconds, wartime civil time, and both new/full-Moon lunar factors.
const indiaReferenceFixtures = [
  { name: 'Great Nicobar', date: '1990-01-01', time: '10:20:30', utc: '1990-01-01T04:50:30.000Z', lat: 6.8, lon: 93.7, ascendant: 356.4497510957559, sun: 280.51018021574885, moon: 329.2588644006482, tithi: 5, karana: 9, yoga: 16 },
  { name: 'Itanagar', date: '2024-04-08', time: '23:30', utc: '2024-04-08T18:00:00.000Z', lat: 27.1, lon: 93.6, ascendant: 277.72110395897005, sun: 19.386208076809048, moon: 19.18267403184567, tithi: 30, karana: 60, yoga: 27 },
  { name: 'Leh', date: '1943-01-01', time: '12:00', utc: '1943-01-01T05:30:00.000Z', lat: 34.15, lon: 77.57, ascendant: 344.7784023932455, sun: 279.9267871407437, moon: 207.64505277219433, tithi: 24, karana: 48, yoga: 7 },
  { name: 'Kavaratti', date: '2024-03-25', time: '06:30', utc: '2024-03-25T01:00:00.000Z', lat: 10.5669, lon: 72.642, ascendant: 0.7456831041214024, sun: 4.87281387567666, moon: 182.15706524494283, tithi: 15, karana: 30, yoga: 11 },
];
for (const reference of indiaReferenceFixtures) {
  test(`Indian location and birth Panchang agree with independent reference at ${reference.name}`, () => {
    const chart = calculateChart({ date: reference.date, time: reference.time, location: { name: reference.name, lat: reference.lat, lon: reference.lon, timeZone: 'Asia/Kolkata' } });
    assert.equal(chart.utc, reference.utc);
    assert.ok(angularDistance(chart.ascendant.longitude + chart.ayanamsa, reference.ascendant) < 0.001);
    assert.ok(angularDistance(chart.planets.find(p => p.name === 'Sun').tropicalLongitude, reference.sun) < 0.01);
    assert.ok(angularDistance(chart.planets.find(p => p.name === 'Moon').tropicalLongitude, reference.moon) < 0.01);
    assert.equal(chart.panchang.tithi.number, reference.tithi);
    assert.equal(chart.panchang.karana.number, reference.karana);
    assert.equal(chart.panchang.yoga.number, reference.yoga);
  });
}

test('approximate Lahiri remains within 0.001 degrees of independent 1900–2100 reference samples', () => {
  // Compare mean-frame values, removing the engine's separately applied nutation.
  const references = [[1900,22.4605497063],[1925,22.8096277978],[1950,23.1587442620],[1975,23.5078991150],[2000,23.8570923537],[2025,24.2063622210],[2050,24.5556322294],[2075,24.9049406241],[2100,25.2542874036]];
  for (const [year, expected] of references) {
    const date = new Date(`${year}-01-01T12:00:00Z`);
    const approximateMean = lahiriAyanamsa(date) - Astronomy.e_tilt(Astronomy.MakeTime(date)).dpsi / 3600;
    assert.ok(Math.abs(approximateMean - expected) < 0.001, `Lahiri reference at ${year}`);
  }
});
