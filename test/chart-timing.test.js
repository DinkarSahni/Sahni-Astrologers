import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateSolarDay, calculatePanchangTransitions } from '../public/chart-timing.js';
import { tropicalLongitude, lahiriAyanamsa } from '../public/chart-engine.js';

const india = { lat: 31.326, lon: 75.5762, timeZone: 'Asia/Kolkata' };
const sidereal = {
  sunLongitude: date => tropicalLongitude('Sun', date) - lahiriAyanamsa(date),
  moonLongitude: date => tropicalLongitude('Moon', date) - lahiriAyanamsa(date),
};
const differenceSeconds = (actual, expected) => Math.abs(Date.parse(actual) - Date.parse(expected)) / 1000;

// Independent fixtures generated outside the project with pyswisseph 2.10.3.2,
// Swiss Ephemeris 2.10.03, FLG_MOSEPH, sea-level upper-limb rise/set, 1013.25hPa,
// 15°C. Astronomy Engine fixes refraction at 34'; modest differences are expected.
// The reference library is not included or needed when the website runs.
const solarReferences = [
  { name: 'Jalandhar', birth: '2000-01-01T12:00:00Z', lat: 31.326, lon: 75.5762, sunrise: '2000-01-01T01:56:30.481Z', sunset: '2000-01-01T12:05:21.085Z' },
  { name: 'Great Nicobar', birth: '2001-02-03T06:00:00Z', lat: 6.992, lon: 93.868, sunrise: '2001-02-03T00:03:11.962Z', sunset: '2001-02-03T11:53:34.087Z' },
  { name: 'Itanagar', birth: '1990-05-17T06:00:00Z', lat: 27.08694, lon: 93.60987, sunrise: '1990-05-16T22:56:50.539Z', sunset: '1990-05-17T12:27:13.897Z' },
  { name: 'Leh', birth: '2024-06-21T06:00:00Z', lat: 34.16504, lon: 77.58402, sunrise: '2024-06-20T23:38:29.574Z', sunset: '2024-06-21T14:04:34.782Z' },
  { name: 'Kavaratti', birth: '2024-12-21T06:00:00Z', lat: 10.56688, lon: 72.64203, sunrise: '2024-12-21T01:22:22.462Z', sunset: '2024-12-21T12:52:52.156Z' },
  { name: 'New York DST', birth: '2024-03-10T12:00:00Z', lat: 40.7128, lon: -74.006, timeZone: 'America/New_York', sunrise: '2024-03-10T11:14:55.929Z', sunset: '2024-03-10T22:57:54.105Z' },
  { name: 'Jalandhar wartime', birth: '1943-01-01T05:30:00Z', lat: 31.326, lon: 75.5762, sunrise: '1943-01-01T01:56:36.630Z', sunset: '1943-01-01T12:05:20.492Z' },
];
for (const reference of solarReferences) {
  test(`solar events agree with independent rise/set reference for ${reference.name}`, () => {
    const solar = calculateSolarDay(reference.birth, { ...reference, timeZone: reference.timeZone || 'Asia/Kolkata' });
    assert.ok(differenceSeconds(solar.sunrise, reference.sunrise) < 30, `${reference.name} sunrise differs by 30 seconds`);
    assert.ok(differenceSeconds(solar.sunset, reference.sunset) < 30, `${reference.name} sunset differs by 30 seconds`);
    assert.ok(Date.parse(solar.previousSunrise) <= Date.parse(reference.birth));
    assert.ok(Date.parse(solar.nextSunrise) > Date.parse(reference.birth));
    assert.ok(solar.dayLengthSeconds > 0 && solar.dayLengthSeconds < 86400);
  });
}

test('sunrise-based Vara changes at sunrise rather than local midnight', () => {
  const dawn = calculateSolarDay('2000-01-01T12:00:00Z', india).sunrise;
  const before = calculateSolarDay(new Date(Date.parse(dawn) - 1), india);
  const at = calculateSolarDay(dawn, india);
  assert.equal(before.date, '2000-01-01');
  assert.equal(before.vara.name, 'Friday');
  assert.equal(before.vara.number, 5);
  assert.equal(at.vara.name, 'Saturday');
  assert.equal(at.vara.number, 6);
  assert.equal(at.previousSunrise, at.sunrise);
  assert.equal(before.nextSunrise, before.sunrise);
});

test('solar date handling follows the birthplace calendar through DST and UTC date boundaries', () => {
  const ny = { lat: 40.7128, lon: -74.006, timeZone: 'America/New_York' };
  assert.equal(calculateSolarDay('2024-03-10T04:30:00Z', ny).date, '2024-03-09');
  const spring = calculateSolarDay('2024-03-10T05:30:00Z', ny);
  assert.equal(spring.date, '2024-03-10');
  assert.equal(spring.vara.name, 'Saturday');
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: ny.timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(spring.sunrise)), '07:14');
  const autumnFirst = calculateSolarDay('2024-11-03T05:30:00Z', ny);
  const autumnSecond = calculateSolarDay('2024-11-03T06:30:00Z', ny);
  assert.equal(autumnFirst.date, '2024-11-03');
  assert.equal(autumnFirst.sunrise, autumnSecond.sunrise);
  assert.equal(autumnFirst.vara.name, 'Saturday');
  assert.equal(calculateSolarDay('1900-01-01T00:00:00Z', india).vara.name, 'Sunday');
});

test('missing polar events remain unavailable and invalid coordinates/timezones are rejected', () => {
  const solar = calculateSolarDay('2024-06-21T12:00:00Z', { lat: 80, lon: 15, timeZone: 'Europe/Oslo' });
  assert.equal(solar.sunrise, null);
  assert.equal(solar.sunset, null);
  assert.equal(solar.vara, null);
  assert.equal(solar.dayLengthSeconds, null);
  assert.throws(() => calculateSolarDay('invalid', india), /valid timing instant/);
  assert.throws(() => calculateSolarDay(null, india), /valid timing instant/);
  assert.throws(() => calculateSolarDay('2000-01-01', { ...india, lat: NaN }), /valid coordinates/);
  assert.throws(() => calculateSolarDay('2000-01-01', { ...india, lat: 91 }), /valid coordinates/);
  assert.throws(() => calculateSolarDay('2000-01-01', { ...india, timeZone: 'Unknown/Place' }), /timezone/);
});

// Independent transition roots: Swiss/Moshier apparent geocentric longitudes,
// Lahiri sidereal mode; binary-searched outside this repository to sub-second
// precision. Test tolerance covers the different lunar ephemeris/ayanamsa model.
const transitionReferences = [
  {
    birth: '2000-01-01T12:00:00Z',
    tithi: ['2000-01-02T07:49:47.089Z', 26, 27], nakshatra: ['2000-01-01T13:03:26.327Z', 15, 16],
    yoga: ['2000-01-02T07:44:17.808Z', 8, 9], karana: ['2000-01-01T18:39:17.365Z', 51, 52],
  },
  {
    birth: '2024-04-08T18:00:00Z',
    tithi: ['2024-04-08T18:20:54.991Z', 30, 1], nakshatra: ['2024-04-09T02:02:09.171Z', 27, 1],
    yoga: ['2024-04-09T08:48:02.200Z', 27, 1], karana: ['2024-04-08T18:20:54.991Z', 60, 1],
  },
  {
    birth: '2024-03-25T06:30:00Z',
    tithi: ['2024-03-25T07:00:20.359Z', 15, 16], nakshatra: ['2024-03-26T08:03:35.281Z', 13, 14],
    yoga: ['2024-03-25T15:59:43.852Z', 11, 12], karana: ['2024-03-25T07:00:20.359Z', 30, 31],
  },
  {
    birth: '1943-01-01T05:30:00Z',
    tithi: ['1943-01-01T06:02:22.659Z', 24, 25], nakshatra: ['1943-01-01T09:10:32.630Z', 14, 15],
    yoga: ['1943-01-02T00:48:51.429Z', 7, 8], karana: ['1943-01-01T06:02:22.659Z', 48, 49],
  },
];
for (const reference of transitionReferences) {
  test(`Panchang boundaries agree with independent ephemeris roots at ${reference.birth}`, () => {
    const transitions = calculatePanchangTransitions(reference.birth, sidereal);
    for (const name of ['tithi', 'nakshatra', 'yoga', 'karana']) {
      const [endsAt, fromNumber, nextNumber] = reference[name];
      const actual = transitions[name];
      assert.equal(actual.fromNumber, fromNumber);
      assert.equal(actual.nextNumber, nextNumber);
      assert.ok(Date.parse(actual.endsAt) > Date.parse(reference.birth));
      assert.ok(differenceSeconds(actual.endsAt, endsAt) < 90, `${name} exceeds 90-second reference tolerance`);
    }
  });
}

test('boundary searches move strictly forward at exact edges and through 360 degrees', () => {
  const birth = Date.parse('2000-01-01T00:00:00Z');
  const growingMoon = initial => ({
    sunLongitude: () => 0,
    moonLongitude: date => initial + 12 * (date.getTime() - birth) / 86400000,
  });
  const wrapped = calculatePanchangTransitions(birth, growingMoon(359));
  assert.equal(wrapped.tithi.fromNumber, 30);
  assert.equal(wrapped.tithi.nextNumber, 1);
  assert.ok(differenceSeconds(wrapped.tithi.endsAt, '2000-01-01T02:00:00Z') <= 1);
  const exact = calculatePanchangTransitions(birth, growingMoon(0));
  assert.equal(exact.tithi.fromNumber, 1);
  assert.ok(differenceSeconds(exact.tithi.endsAt, '2000-01-02T00:00:00Z') <= 1);
  assert.ok(differenceSeconds(exact.karana.endsAt, '2000-01-01T12:00:00Z') <= 1);
});

test('invalid and nonprogressing ephemeris callbacks cannot produce invented transition times', () => {
  const birth = '2000-01-01T00:00:00Z';
  assert.throws(() => calculatePanchangTransitions(birth), /longitude functions/);
  assert.throws(() => calculatePanchangTransitions(birth, { sunLongitude: () => NaN, moonLongitude: () => 0 }), /invalid longitude/);
  assert.throws(() => calculatePanchangTransitions(birth, { sunLongitude: () => 0, moonLongitude: () => 0 }), /could not be bracketed/);
});
