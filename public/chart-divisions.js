/**
 * Explicit Parashari divisional-sign conventions. This module is independent
 * of the numerical ephemeris and makes no network requests.
 *
 * These are sign allocations, not extra astronomical measurements. In
 * particular D2 and D30 must not be treated as simple harmonic multiplication.
 * D60 here counts forward from the natal sign without even-sign reversal.
 * See docs/divisions.md for the rule table, sources, variants and limitations.
 */

const SIGNS = Object.freeze(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']);
const definition = (factor, label, description, convention) => Object.freeze({ id: `D${factor}`, factor, label, description, convention });

export const divisionDefinitions = Object.freeze([
  definition(1, 'Rasi', 'The sidereal birth chart.', 'Natal zodiac sign; whole-sign houses.'),
  definition(2, 'Hora', 'The traditional Sun/Moon Hora allocation.', 'Odd natal signs: Leo then Cancer. Even natal signs: Cancer then Leo.'),
  definition(3, 'Drekkana', 'Three equal parts of each natal sign.', 'Count the natal sign, its fifth and its ninth.'),
  definition(4, 'Chaturthamsa', 'Four equal parts of each natal sign.', 'Count the natal sign, its fourth, seventh and tenth.'),
  definition(7, 'Saptamsa', 'Seven equal parts of each natal sign.', 'Start from the natal sign in odd signs; its seventh in even signs. Count forward.'),
  definition(9, 'Navamsa', 'Nine equal parts of each natal sign.', 'Start from the natal sign for movable signs, its ninth for fixed signs and its fifth for dual signs.'),
  definition(10, 'Dasamsa', 'Ten equal parts of each natal sign.', 'Start from the natal sign in odd signs; its ninth in even signs. Count forward.'),
  definition(12, 'Dvadasamsa', 'Twelve equal parts of each natal sign.', 'Start from the natal sign and count forward.'),
  definition(16, 'Shodasamsa', 'Sixteen equal parts of each natal sign.', 'Start from Aries, Leo or Sagittarius for movable, fixed or dual natal signs. Count forward.'),
  definition(20, 'Vimsamsa', 'Twenty equal parts of each natal sign.', 'Start from Aries, Sagittarius or Leo for movable, fixed or dual natal signs. Count forward.'),
  definition(24, 'Chaturvimsamsa', 'Twenty-four equal parts of each natal sign.', 'Start from Leo in odd natal signs; Cancer in even natal signs. Count forward.'),
  definition(27, 'Bhamsa', 'Twenty-seven equal parts of each natal sign.', 'Start from Aries, Cancer, Libra or Capricorn for fire, earth, air or water natal signs. Count forward.'),
  definition(30, 'Trimsamsa', 'The traditional five unequal segments of each natal sign.', 'Odd signs: Aries 0–5°, Aquarius 5–10°, Sagittarius 10–18°, Gemini 18–25°, Libra 25–30°. Even signs: Taurus 0–5°, Virgo 5–12°, Pisces 12–20°, Capricorn 20–25°, Scorpio 25–30°.'),
  definition(40, 'Khavedamsa', 'Forty equal parts of each natal sign.', 'Start from Aries in odd natal signs; Libra in even natal signs. Count forward.'),
  definition(45, 'Akshavedamsa', 'Forty-five equal parts of each natal sign.', 'Start from Aries, Leo or Sagittarius for movable, fixed or dual natal signs. Count forward.'),
  definition(60, 'Shashtyamsa', 'Sixty equal parts; highly sensitive to birth time.', 'From-natal-sign variant: start from the natal sign and count forward, with no even-sign reversal. This is not the from-Aries variant or a deity table.'),
]);
const byId = new Map(divisionDefinitions.map(item => [item.id, item]));
const oddTrimsamsa = Object.freeze([[0, 5, 0], [5, 10, 10], [10, 18, 8], [18, 25, 2], [25, 30, 6]]);
const evenTrimsamsa = Object.freeze([[0, 5, 1], [5, 12, 5], [12, 20, 11], [20, 25, 9], [25, 30, 7]]);

function normalise(longitude) {
  if (typeof longitude !== 'number' || !Number.isFinite(longitude)) throw new Error('A divisional position requires a finite numeric sidereal longitude.');
  const remainder = longitude % 360;
  const value = remainder < 0 ? remainder + 360 : remainder === 0 ? 0 : remainder;
  // Adding a tiny negative remainder to 360 can round up to 360 itself.
  // Preserve its side of the cusp using the largest representable value below it.
  return value === 360 ? 360 - Number.EPSILON * 256 : value;
}

function equalPart(sourceLongitude, degree, factor) {
  const scaled = degree * factor / 30;
  const nearest = Math.round(scaled);
  // Subtracting the natal sign at a rational cusp can lose a few floating-point
  // ulps. Snap only internal boundaries within that arithmetic error; never
  // promote a value just below the next natal sign into that sign.
  const tolerance = Number.EPSILON * Math.max(1, sourceLongitude) * factor / 30 * 4;
  const stable = nearest > 0 && nearest < factor && Math.abs(scaled - nearest) <= tolerance ? nearest : scaled;
  return Math.min(factor - 1, Math.floor(stable));
}

/**
 * Allocate one sidereal longitude to a divisional sign. Parts are one-based;
 * signs are zero-based. D30 has five unequal parts, although its factor is 30.
 * No divisional degree or new nakshatra is invented from the natal position.
 */
export function divisionalPosition(longitude, id) {
  const spec = byId.get(id);
  if (!spec) throw new Error('Choose a supported divisional chart.');
  const sourceLongitude = normalise(longitude);
  const natalSign = Math.floor(sourceLongitude / 30);
  const sourceDegree = sourceLongitude - natalSign * 30;
  const odd = natalSign % 2 === 0;
  const modality = natalSign % 3; // movable, fixed, dual
  let part = equalPart(sourceLongitude, sourceDegree, spec.factor);
  let signIndex;
  let partCount = spec.factor;
  let segmentStart = part * 30 / spec.factor;
  let segmentEnd = (part + 1) * 30 / spec.factor;

  switch (spec.factor) {
    case 1: signIndex = natalSign; break;
    case 2: signIndex = odd ? (part === 0 ? 4 : 3) : (part === 0 ? 3 : 4); break;
    case 3: signIndex = natalSign + part * 4; break;
    case 4: signIndex = natalSign + part * 3; break;
    case 7: signIndex = natalSign + (odd ? 0 : 6) + part; break;
    case 9: signIndex = natalSign + [0, 8, 4][modality] + part; break;
    case 10: signIndex = natalSign + (odd ? 0 : 8) + part; break;
    case 12: signIndex = natalSign + part; break;
    case 16:
    case 45: signIndex = [0, 4, 8][modality] + part; break;
    case 20: signIndex = [0, 8, 4][modality] + part; break;
    case 24: signIndex = (odd ? 4 : 3) + part; break;
    case 27: signIndex = (natalSign % 4) * 3 + part; break;
    case 30: {
      const segments = odd ? oddTrimsamsa : evenTrimsamsa;
      part = segments.findIndex(([start, end]) => sourceDegree >= start && sourceDegree < end);
      [segmentStart, segmentEnd, signIndex] = segments[part];
      partCount = 5;
      break;
    }
    case 40: signIndex = (odd ? 0 : 6) + part; break;
    case 60: signIndex = natalSign + part; break;
    default: throw new Error('Unsupported divisional factor.');
  }
  signIndex %= 12;
  return {
    id: spec.id, factor: spec.factor, signIndex, sign: SIGNS[signIndex],
    part: part + 1, partCount, sourceLongitude, sourceSignIndex: natalSign, sourceDegree,
    segmentStart, segmentEnd,
  };
}

/** Build each division with its own ascendant and whole-sign house numbering. */
export function calculateDivisions(ascendantLongitude, planets) {
  normalise(ascendantLongitude);
  if (!Array.isArray(planets) || !planets.length) throw new Error('Divisional charts require planetary positions.');
  const seen = new Set();
  for (const planet of planets) {
    if (!planet || typeof planet !== 'object' || typeof planet.name !== 'string' || !planet.name.trim() || seen.has(planet.name)) throw new Error('Each divisional planet requires a distinct name.');
    normalise(planet.longitude);
    seen.add(planet.name);
  }
  return Object.fromEntries(divisionDefinitions.map(spec => {
    const ascendant = divisionalPosition(ascendantLongitude, spec.id);
    const positions = planets.map(planet => {
      const position = divisionalPosition(planet.longitude, spec.id);
      return {
        name: planet.name, retrograde: Boolean(planet.retrograde),
        ...(Number.isFinite(planet.speedDegreesPerDay) ? { speedDegreesPerDay: planet.speedDegreesPerDay } : {}),
        ...position, house: (position.signIndex - ascendant.signIndex + 12) % 12 + 1,
        natal: Object.freeze({ ...planet }),
      };
    });
    return [spec.id, { id: spec.id, definition: spec, ascendant, planets: positions, houses: 'Whole sign within this division' }];
  }));
}
