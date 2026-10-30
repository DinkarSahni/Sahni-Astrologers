/**
 * Deterministic client-side Vedic chart calculator. This module makes no network requests.
 * Planetary positions: Astronomy Engine (MIT), geocentric apparent true ecliptic of date.
 * Nodes: Meeus mean ascending-node polynomial, or an explicitly approximate
 * osculating ascending node from Astronomy Engine's geocentric lunar state.
 * Ayanamsa: a precession approximation to Lahiri, with nutation applied to match the
 * true ecliptic frame. It is explicitly labelled approximate, not Swiss Ephemeris.
 * Interpretations and professional chart approval are outside this calculation module.
 */
import * as Astronomy from './vendor/astronomy-engine.js';
import { calculateDivisions, divisionalPosition } from './chart-divisions.js';
import { calculateSolarDay, calculatePanchangTransitions } from './chart-timing.js';
import { cities } from './chart-cities.js';
export { cities } from './chart-cities.js';

export const calculationVersion = 'sahni-kundali-2.0.0';

export const SIGNS = Object.freeze(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']);
export const NAKSHATRAS = Object.freeze(['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishtha', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati']);
const DASHA_ORDER = Object.freeze(['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury']);
const DASHA_YEARS = Object.freeze({ Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 });
const DAY_MS = 86400000;
const RAD = Math.PI / 180;
const TITHI_NAMES = Object.freeze(['Pratipada', 'Dvitiya', 'Tritiya', 'Chaturthi', 'Panchami', 'Shashthi', 'Saptami', 'Ashtami', 'Navami', 'Dashami', 'Ekadashi', 'Dvadashi', 'Trayodashi', 'Chaturdashi']);
const YOGA_NAMES = Object.freeze(['Vishkambha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda', 'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata', 'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyana', 'Parigha', 'Shiva', 'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti']);
const REPEATING_KARANAS = Object.freeze(['Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti']);
const WEEKDAYS = Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const locationById = new Map(cities.map(location => [location.id, location]));


export function normalizeDegrees(value) {
  const remainder = value % 360;
  return remainder < 0 ? remainder + 360 : remainder;
}

function angularDifference(a, b) {
  return normalizeDegrees(a - b + 180) - 180;
}

/** Return the unique UTC instant for local civil time, using the IANA timezone database. */
export function localToUtc(date, time, timeZone) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof time !== 'string' || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) {
    throw new Error('Enter a valid birth date and time.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = time.split(':').map(Number);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new Error('Use a valid date between 1900 and 2100 and a time in 24-hour format.');
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const check = new Date(wall);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new Error('That calendar date does not exist.');
  }
  let formatter;
  try {
    if (typeof timeZone !== 'string' || !timeZone) throw new Error('Missing civil timezone.');
    formatter = new Intl.DateTimeFormat('en-GB-u-ca-gregory-nu-latn', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
  } catch {
    throw new Error('The selected city timezone is not supported by this browser.');
  }
  const localMs = (instant) => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).filter((x) => x.type !== 'literal').map((x) => [x.type, Number(x.value)]));
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  };
  const offsets = new Set();
  // Sampling both sides of a date detects historical/DST offset transitions, not
  // merely the current offset. Seconds are retained for older civil time zones.
  for (let hours = -48; hours <= 48; hours += 6) {
    const instant = wall + hours * 3600000;
    offsets.add(localMs(instant) - instant);
  }
  const matches = [...offsets].map((offset) => wall - offset).filter((instant) => localMs(instant) === wall);
  if (matches.length === 0) throw new Error('This local time did not exist because the clocks changed. Please check the birth record.');
  if (matches.length > 1) throw new Error('This local time occurred twice when the clocks changed. Please ask us to verify the birth time before calculating.');
  return new Date(matches[0]);
}

/** Mean Lahiri at J2000 plus general precession; apparent frame adds nutation. */
export function lahiriAyanamsa(date) {
  const astro = Astronomy.MakeTime(date);
  const T = astro.tt / 36525;
  const precession = (5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T) / 3600;
  return 23.857092353 + precession + Astronomy.e_tilt(astro).dpsi / 3600;
}

export function tropicalLongitude(body, date) {
  return Astronomy.Ecliptic(Astronomy.GeoVector(body, date, true)).elon;
}

export function meanNodeLongitude(date) {
  const astro = Astronomy.MakeTime(date);
  const T = astro.tt / 36525;
  return normalizeDegrees(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000 + Astronomy.e_tilt(astro).dpsi / 3600);
}

/**
 * Approximate osculating lunar ascending node in the true ecliptic of date.
 * For geocentric position r and velocity v, h = r × v is the orbital normal;
 * the ascending-node direction is k × h = (-h.y, h.x, 0).
 * Both state vectors use the same instantaneous rotation: this is a physical
 * orbital plane, not a numerical derivative of a moving coordinate frame.
 * Validated samples differ from Swiss/Moshier by up to 0.015 degrees, so this
 * option is labelled approximate and is never silently substituted for mean.
 */
export function trueNodeLongitude(date) {
  const state = Astronomy.RotateState(Astronomy.Rotation_EQJ_ECT(date), Astronomy.GeoMoonState(date));
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  if (![hx, hy].every(Number.isFinite) || Math.hypot(hx, hy) === 0) throw new Error('The lunar orbital node could not be calculated.');
  return normalizeDegrees(Math.atan2(hx, -hy) / RAD);
}

function resolveCalculationSettings(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Choose valid chart calculation settings.');
  const supportedKeys = new Set(['node', 'ayanamsa', 'dashaYearDays']);
  if (Object.keys(value).some(key => !supportedKeys.has(key))) throw new Error('A requested chart setting is not supported.');
  const node = value.node ?? 'mean';
  const ayanamsa = value.ayanamsa ?? 'lahiri';
  const dashaYearDays = value.dashaYearDays ?? 365.25;
  if (!['mean', 'true'].includes(node)) throw new Error('Choose the mean or approximate true lunar node.');
  if (ayanamsa !== 'lahiri') throw new Error('Only the declared Lahiri ayanamsa is supported.');
  if (![365.25, 360].includes(dashaYearDays)) throw new Error('Choose a 365.25-day or 360-day dasha year.');
  return { node, ayanamsa, dashaYearDays };
}

export function ascendantLongitude(date, latitude, longitude) {
  if (![latitude, longitude].every(Number.isFinite) || Math.abs(latitude) >= 66 || Math.abs(longitude) > 180) {
    throw new Error('Coordinates must be valid and outside polar latitudes.');
  }
  const astro = Astronomy.MakeTime(date);
  const theta = (Astronomy.SiderealTime(astro) * 15 + longitude) * RAD;
  const epsilon = Astronomy.e_tilt(astro).tobl * RAD;
  return normalizeDegrees(Math.atan2(Math.cos(theta), -(Math.sin(theta) * Math.cos(epsilon) + Math.tan(latitude * RAD) * Math.sin(epsilon))) / RAD);
}

export function wholeSignHouse(longitude, ascendant) {
  return (Math.floor(normalizeDegrees(longitude) / 30) - Math.floor(normalizeDegrees(ascendant) / 30) + 12) % 12 + 1;
}

function describeLongitude(longitude) {
  const value = normalizeDegrees(longitude);
  const signIndex = Math.floor(value / 30);
  const nakshatraPosition = value * 3 / 40;
  const nakshatraIndex = Math.min(26, Math.floor(nakshatraPosition));
  const navamsaSignIndex = divisionalPosition(value, 'D9').signIndex;
  return {
    longitude: value,
    sign: SIGNS[signIndex], signIndex, degree: value % 30,
    nakshatra: NAKSHATRAS[nakshatraIndex], pada: Math.min(4, Math.floor((nakshatraPosition - nakshatraIndex) * 4) + 1),
    nakshatraLord: DASHA_ORDER[nakshatraIndex % 9],
    navamsaSign: SIGNS[navamsaSignIndex], navamsaSignIndex,
  };
}

export function calculateDashas(birth, moonLongitude, now = new Date(), { yearDays = 365.25, depth = 3 } = {}) {
  const birthMs = new Date(birth).getTime();
  const nowMs = new Date(now).getTime();
  if (!Number.isFinite(birthMs) || !Number.isFinite(nowMs) || !Number.isFinite(moonLongitude)) throw new Error('Invalid dasha input.');
  if (![365.25, 360].includes(yearDays) || !Number.isInteger(depth) || depth < 1 || depth > 3) throw new Error('Invalid dasha year or depth.');
  const yearMs = yearDays * DAY_MS;
  const divide = (parentStart, parentEnd, firstIndex, clipStart, clipEnd, thirdLevel = false) => {
    const children = [];
    const fullDuration = parentEnd - parentStart;
    let childStart = parentStart;
    for (let index = 0; index < 9; index++) {
      const orderIndex = (firstIndex + index) % 9;
      const planet = DASHA_ORDER[orderIndex];
      const childEnd = index === 8 ? parentEnd : childStart + fullDuration * DASHA_YEARS[planet] / 120;
      const start = Math.max(clipStart, childStart), end = Math.min(clipEnd, childEnd);
      if (end > start) {
        const child = { planet, start: new Date(start).toISOString(), end: new Date(end).toISOString(), fullStart: new Date(childStart).toISOString(), fullEnd: new Date(childEnd).toISOString(), isCurrent: nowMs >= start && nowMs < end };
        // The complete antardasha anchors the third-level sequence, even when
        // birth clips its beginning. Redistributing the remaining interval
        // would give a different and incorrect first pratyantardasha.
        if (thirdLevel) child.pratyantardashas = divide(childStart, childEnd, orderIndex, start, end);
        children.push(child);
      }
      childStart = childEnd;
    }
    return children;
  };
  const nak = normalizeDegrees(moonLongitude) * 3 / 40;
  const firstIndex = Math.floor(nak) % 9;
  const fractionElapsed = nak - Math.floor(nak);
  let fullStart = birthMs - fractionElapsed * DASHA_YEARS[DASHA_ORDER[firstIndex]] * yearMs;
  const horizon = birthMs + 120 * yearMs;
  const periods = [];
  for (let n = 0; n < 11 && fullStart < horizon; n++) {
    const index = (firstIndex + n) % 9;
    const planet = DASHA_ORDER[index];
    const fullYears = DASHA_YEARS[planet];
    const fullEnd = fullStart + fullYears * yearMs;
    const start = Math.max(birthMs, fullStart);
    const end = Math.min(horizon, fullEnd);
    const antardashas = depth >= 2 ? divide(fullStart, fullEnd, index, start, end, depth === 3) : [];
    periods.push({ planet, start: new Date(start).toISOString(), end: new Date(end).toISOString(), fullStart: new Date(fullStart).toISOString(), fullEnd: new Date(fullEnd).toISOString(), fullYears, years: (end - start) / yearMs, isCurrent: nowMs >= start && nowMs < end, antardashas });
    fullStart = fullEnd;
  }
  return periods;
}

/** Birth-instant lunar factors. Weekday is civil midnight-based, not sunrise vara. */
export function calculatePanchang(sunLongitude, moonLongitude, birth, timeZone) {
  if (![sunLongitude, moonLongitude].every(Number.isFinite) || !Number.isFinite(new Date(birth).getTime()) || typeof timeZone !== 'string' || !timeZone) throw new Error('Invalid Panchang input.');
  const angle = normalizeDegrees(moonLongitude - sunLongitude);
  const tithiIndex = Math.floor(angle / 12);
  const day = tithiIndex % 15 + 1;
  const yogaAngle = normalizeDegrees(sunLongitude + moonLongitude);
  const yogaIndex = Math.min(26, Math.floor(yogaAngle * 3 / 40));
  const karanaIndex = Math.floor(angle / 6);
  const karana = karanaIndex === 0 ? 'Kimstughna'
    : karanaIndex >= 57 ? ['Shakuni', 'Chatushpada', 'Naga'][karanaIndex - 57]
      : REPEATING_KARANAS[(karanaIndex - 1) % 7];
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone }).format(new Date(birth));
  return {
    tithi: { number: tithiIndex + 1, day, name: day === 15 ? (tithiIndex === 14 ? 'Purnima' : 'Amavasya') : TITHI_NAMES[day - 1], paksha: tithiIndex < 15 ? 'Shukla' : 'Krishna', angle },
    yoga: { number: yogaIndex + 1, name: YOGA_NAMES[yogaIndex], angle: yogaAngle },
    karana: { number: karanaIndex + 1, name: karana },
    weekday: { number: WEEKDAYS.indexOf(weekday), name: weekday, convention: 'Local civil day, midnight-based' },
  };
}

function resolveLocation(cityId, manualLocation) {
  if (cityId !== undefined && manualLocation !== undefined) throw new Error('Choose one birth location: a listed place or manual coordinates.');
  if (manualLocation === undefined) {
    const location = locationById.get(cityId);
    if (!location) throw new Error('Choose a supported birth city. We do not substitute a different location.');
    return location;
  }
  if (!manualLocation || typeof manualLocation !== 'object' || Array.isArray(manualLocation)) throw new Error('Enter a valid manual birth location.');
  const { name, lat, lon, timeZone } = manualLocation;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 160 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error('Enter a birth-place name between 2 and 160 characters.');
  if (![lat, lon].every(Number.isFinite) || lat < 6 || lat > 38 || lon < 68 || lon > 98) throw new Error('For an Indian birth place, enter latitude 6–38° north and longitude 68–98° east.');
  if (timeZone !== 'Asia/Kolkata') throw new Error('Manual Indian locations must use the Asia/Kolkata civil timezone.');
  // This envelope supports mainland and island locations; it is not a geocoder
  // or a political-boundary check. Never infer or substitute a nearby city.
  return Object.freeze({ id: 'custom-india', name: name.trim(), lat, lon, timeZone, source: 'manual' });
}

export function calculateChart({ date, time, cityId, location: manualLocation, settings, now = new Date() } = {}) {
  const options = resolveCalculationSettings(settings);
  const location = resolveLocation(cityId, manualLocation);
  const utcDate = localToUtc(date, time, location.timeZone);
  const ayanamsa = lahiriAyanamsa(utcDate);
  const ascendant = describeLongitude(ascendantLongitude(utcDate, location.lat, location.lon) - ayanamsa);
  const bodies = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  // A short central difference approximates birth-instant motion, rather than
  // averaging a full day across a nearby direct/retrograde station.
  const motionStepMs = 5 * 60000;
  const before = new Date(utcDate.getTime() - motionStepMs);
  const after = new Date(utcDate.getTime() + motionStepMs);
  const planets = bodies.map((name) => {
    const tropical = tropicalLongitude(name, utcDate);
    const speedDegreesPerDay = angularDifference(tropicalLongitude(name, after), tropicalLongitude(name, before)) * DAY_MS / (2 * motionStepMs);
    return { name, tropicalLongitude: tropical, ...describeLongitude(tropical - ayanamsa), house: wholeSignHouse(tropical - ayanamsa, ascendant.longitude), speedDegreesPerDay, retrograde: speedDegreesPerDay < 0 };
  });
  const nodeLongitude = options.node === 'true' ? trueNodeLongitude : meanNodeLongitude;
  const rahu = nodeLongitude(utcDate);
  for (const [name, tropical] of [['Rahu', rahu], ['Ketu', normalizeDegrees(rahu + 180)]]) {
    const speedDegreesPerDay = angularDifference(nodeLongitude(after), nodeLongitude(before)) * DAY_MS / (2 * motionStepMs);
    planets.push({ name, tropicalLongitude: tropical, ...describeLongitude(tropical - ayanamsa), house: wholeSignHouse(tropical - ayanamsa, ascendant.longitude), speedDegreesPerDay, retrograde: speedDegreesPerDay < 0, motionUncertain: options.node === 'true' && Math.abs(speedDegreesPerDay) < 0.015 });
  }
  const moon = planets.find((p) => p.name === 'Moon');
  const siderealPositions = new Map([[utcDate.getTime(), { sun: planets[0].longitude, moon: moon.longitude }]]);
  const at = instant => {
    const key = instant.getTime();
    if (!siderealPositions.has(key)) {
      const offset = lahiriAyanamsa(instant);
      siderealPositions.set(key, { sun: normalizeDegrees(tropicalLongitude('Sun', instant) - offset), moon: normalizeDegrees(tropicalLongitude('Moon', instant) - offset) });
    }
    return siderealPositions.get(key);
  };
  return {
    calculationVersion, date, time, city: location, utc: utcDate.toISOString(), ayanamsa, ascendant, planets,
    moonSign: moon.sign, sunSign: planets[0].sign, nakshatra: moon.nakshatra, nakshatraPada: moon.pada, nakshatraLord: moon.nakshatraLord,
    panchang: calculatePanchang(planets[0].longitude, moon.longitude, utcDate, location.timeZone),
    divisions: calculateDivisions(ascendant.longitude, planets),
    solarDay: calculateSolarDay(utcDate, location),
    panchangTransitions: calculatePanchangTransitions(utcDate, { sunLongitude: instant => at(instant).sun, moonLongitude: instant => at(instant).moon }),
    dashas: calculateDashas(utcDate, moon.longitude, now, { yearDays: options.dashaYearDays }),
    settings: { calculationVersion, engine: 'Astronomy Engine 2.1.19', zodiac: 'Sidereal', ayanamsa: 'Lahiri approximation', ayanamsaMode: options.ayanamsa, node: options.node === 'true' ? 'Approximate osculating true lunar node' : 'Mean lunar node', nodeMode: options.node, nodeMethod: options.node === 'true' ? 'Geocentric Moon orbital plane from position and velocity' : 'Meeus mean ascending-node polynomial', birthTimeResolutionSeconds: time.length === 8 ? 1 : 60, houses: 'Whole sign', dashaYearDays: options.dashaYearDays, dashaDepth: 3, panchang: 'Birth-instant factors and next boundaries; civil weekday and sunrise-based Vara', location: location.source === 'manual' ? 'User-supplied coordinates; not geocoded' : 'Listed place coordinates' },
    warnings: [
      `Uses ${location.source === 'manual' ? 'user-supplied' : 'listed place'} coordinates and an approximate Lahiri ayanamsa. Small differences near sign, nakshatra or D9 boundaries can change the result.`,
      options.node === 'true' ? 'Rahu and Ketu use an approximate osculating true node. Position differences can approach one arcminute; motion near a node station is marked uncertain.' : 'Rahu and Ketu use the mean node, not the true node. Choose matching settings when comparing another chart.',
      'For a professional reading, have our team at Sahni Astrologers check the birth record and chart. Results describe traditional astrological classifications, not scientific predictions.',
    ],
  };
}
