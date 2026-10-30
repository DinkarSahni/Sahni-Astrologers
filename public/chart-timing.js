/** Local solar events and birth-instant Panchang transition searches. No network. */
import * as Astronomy from './vendor/astronomy-engine.js';

const DAY_MS = 86400000;
const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const normalise = value => ((value % 360) + 360) % 360;
const instant = value => {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') throw new Error('Enter a valid timing instant.');
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error('Enter a valid timing instant.');
  return result;
};

function calendar(timeZone) {
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
    });
  } catch { throw new Error('The birth-place civil timezone is not supported.'); }
  return date => {
    const parts = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    return { date: `${parts.year}-${parts.month}-${parts.day}`, day: Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)), weekday: parts.weekday };
  };
}

// Find the first instant of a local calendar day. Searching calendar dates, rather
// than assuming UTC+05:30 or 24-hour days, also handles DST and older clock offsets.
function startOfDay(day, localCalendar) {
  let low = day - 2 * DAY_MS;
  let high = day + 2 * DAY_MS;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (localCalendar(new Date(middle)).day < day) low = middle;
    else high = middle;
  }
  if (localCalendar(new Date(high)).day !== day) throw new Error('This local calendar date did not occur in the selected timezone.');
  return high;
}

/**
 * Sea-level apparent upper-limb solar events, with Astronomy Engine's standard
 * 34-arcminute refraction. Elevation, mountains, and current weather are not used.
 * Vara follows the most recent sunrise, rather than midnight. Event times are UTC.
 */
export function calculateSolarDay(birth, location) {
  const date = instant(birth);
  if (!location || ![location.lat, location.lon].every(Number.isFinite) || Math.abs(location.lat) > 90 || Math.abs(location.lon) > 180 || typeof location.timeZone !== 'string' || !location.timeZone) {
    throw new Error('Enter valid coordinates and a civil timezone for solar events.');
  }
  const localCalendar = calendar(location.timeZone);
  const local = localCalendar(date);
  const start = startOfDay(local.day, localCalendar);
  const end = startOfDay(local.day + DAY_MS, localCalendar);
  const observer = new Astronomy.Observer(location.lat, location.lon, 0);
  const onThisDay = direction => {
    const event = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, direction, new Date(start), (end - start) / DAY_MS);
    const value = event?.date.getTime();
    return value !== undefined && value >= start && value < end ? event.date : null;
  };
  const sunrise = onThisDay(+1);
  const sunset = onThisDay(-1);
  let previous = sunrise && sunrise.getTime() <= date.getTime() ? sunrise
    : Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, new Date(start - 1), -2)?.date || null;
  let next = sunrise && sunrise.getTime() > date.getTime() ? sunrise
    : Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, new Date(end), 2)?.date || null;
  if (previous && previous.getTime() > date.getTime()) previous = null;
  if (next && next.getTime() <= date.getTime()) next = null;
  const weekday = sunrise && previous ? localCalendar(previous).weekday : null;
  return {
    date: local.date,
    timeZone: location.timeZone,
    sunrise: sunrise?.toISOString() || null,
    sunset: sunset?.toISOString() || null,
    previousSunrise: previous?.toISOString() || null,
    nextSunrise: next?.toISOString() || null,
    vara: weekday ? { number: WEEKDAYS.indexOf(weekday), name: weekday, convention: 'Sunrise-based weekday' } : null,
    dayLengthSeconds: sunrise && sunset && sunset > sunrise ? Math.round((sunset - sunrise) / 1000) : null,
    convention: 'Sea-level apparent solar upper limb; standard 34-arcminute refraction; no terrain or live weather correction',
  };
}

/**
 * Find the next limb boundaries after birth using the caller's sidereal solar
 * and lunar longitudes. No ephemeris is imported twice and no core-module cycle
 * is needed. Geocentric Moon motion is increasing for these four lunar factors.
 */
export function calculatePanchangTransitions(birth, { sunLongitude, moonLongitude } = {}) {
  const date = instant(birth);
  if (typeof sunLongitude !== 'function' || typeof moonLongitude !== 'function') throw new Error('Panchang transition searches require solar and lunar longitude functions.');
  const start = date.getTime();
  const positions = new Map();
  const at = time => {
    if (!positions.has(time)) {
      const point = new Date(time);
      const sun = sunLongitude(point), moon = moonLongitude(point);
      if (![sun, moon].every(Number.isFinite)) throw new Error('The ephemeris returned an invalid longitude during a Panchang search.');
      positions.set(time, { sun: normalise(sun), moon: normalise(moon) });
    }
    return positions.get(time);
  };
  const search = (width, count, angle) => {
    const initial = normalise(angle(at(start)));
    const fromNumber = Math.min(count, Math.floor(initial / width) + 1);
    const targetDistance = fromNumber * width - initial;
    let low = start;
    let high = start;
    let bracketed = false;
    // Every physical tithi/nakshatra/yoga/karana completes well inside four days.
    // Hourly sampling prevents accidentally skipping a wrapped 360-degree edge.
    for (let step = 1; step <= 96; step++) {
      high = start + step * 3600000;
      const travelled = normalise(angle(at(high)) - initial);
      if (travelled >= targetDistance && travelled < 180) { bracketed = true; break; }
      low = high;
    }
    if (!bracketed) throw new Error('A Panchang boundary could not be bracketed within four days.');
    while (high - low > 1000) {
      const middle = Math.floor((low + high) / 2);
      const travelled = normalise(angle(at(middle)) - initial);
      if (travelled >= targetDistance && travelled < 180) high = middle;
      else low = middle;
    }
    return { endsAt: new Date(high).toISOString(), fromNumber, nextNumber: fromNumber % count + 1 };
  };
  return {
    tithi: search(12, 30, ({ sun, moon }) => moon - sun),
    nakshatra: search(40 / 3, 27, ({ moon }) => moon),
    yoga: search(40 / 3, 27, ({ sun, moon }) => sun + moon),
    karana: search(6, 60, ({ sun, moon }) => moon - sun),
    precisionSeconds: 1,
    convention: 'Next geocentric limb boundary strictly after birth; uses the chart sidereal settings',
  };
}
