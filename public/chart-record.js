/** Explicit, local-only chart snapshots. No browser storage or network access. */
const FORMAT = 'sahni-astrologers-kundali';
const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PLANETS = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
const error = path => { throw new Error(`Cannot export chart: invalid ${path}.`); };
const string = (maximum = 500) => (value, path) => typeof value === 'string' && value.length <= maximum ? value : error(path);
const number = (minimum = -Infinity, maximum = Infinity) => (value, path) => typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : error(path);
const integer = (minimum, maximum) => (value, path) => Number.isInteger(value) ? number(minimum, maximum)(value, path) : error(path);
const boolean = (value, path) => typeof value === 'boolean' ? value : error(path);
const plainData = (value, path) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) error(path);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(descriptor => !Object.hasOwn(descriptor, 'value'))) error(path);
  return descriptors;
};
const choice = choices => (value, path) => choices.includes(value) ? value : error(path);
const optional = rule => Object.assign((value, path) => rule(value, path), { optional: true });
const nullable = rule => (value, path) => value === null ? null : rule(value, path);
const array = (rule, maximum = 1000) => (value, path) => Array.isArray(value) && value.length <= maximum
  ? Array.from(value, (item, index) => rule(item, `${path}[${index}]`)) : error(path);
const shape = rules => (value, path) => {
  const descriptors = plainData(value, path);
  const result = {};
  for (const [key, rule] of Object.entries(rules)) {
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.value === undefined) {
      if (descriptor && !Object.hasOwn(descriptor, 'value')) error(`${path}.${key}`);
      if (rule.optional) continue;
      error(`${path}.${key}`);
    }
    result[key] = rule(descriptor.value, `${path}.${key}`);
  }
  return result;
};
const instant = (value, path) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) error(path);
  const normalized = new Date(value).toISOString();
  if (normalized.slice(0, 10) !== value.slice(0, 10)) error(path);
  return normalized;
};
const date = (value, path) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) error(path);
  return value;
};
const time = (value, path) => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value) ? value : error(path);
const degree = number(0, 360);
const positionRules = {
  longitude: optional(degree), sign: choice(SIGNS), signIndex: integer(0, 11), degree: optional(number(0, 30)),
  nakshatra: optional(string(100)), pada: optional(integer(1, 4)), nakshatraLord: optional(choice(PLANETS)),
  navamsaSign: optional(choice(SIGNS)), navamsaSignIndex: optional(integer(0, 11)),
};
const position = shape(positionRules);
const planet = shape({ name: choice(PLANETS), ...positionRules, tropicalLongitude: optional(degree), house: integer(1, 12), speedDegreesPerDay: optional(number()), retrograde: boolean, motionUncertain: optional(boolean) });
const place = shape({
  id: string(160), name: string(500), lat: number(-90, 90), lon: number(-180, 180), timeZone: string(100),
  placeName: optional(string(300)), region: optional(string(200)), district: optional(string(200)), country: optional(string(10)), source: optional(string(500)),
});
const settings = shape({
  engine: string(500), zodiac: string(100), ayanamsa: string(500), node: string(500), houses: string(100), dashaYearDays: number(1, 1000),
  panchang: optional(string(1000)), location: optional(string(1000)), calculationVersion: optional(string(100)),
  nodeMode: optional(choice(['mean', 'true'])), ayanamsaId: optional(string(100)), nodeAccuracy: optional(string(1000)),
  ayanamsaMode: optional(choice(['lahiri'])), nodeMethod: optional(string(2000)), birthTimeResolutionSeconds: optional(choice([1, 60])), dashaDepth: optional(integer(1, 3)),
});
const lunarFactor = shape({ number: integer(1, 60), name: string(100), day: optional(integer(1, 15)), paksha: optional(choice(['Shukla', 'Krishna'])), angle: optional(degree), convention: optional(string(1000)) });
const weekday = shape({ number: integer(0, 6), name: string(50), convention: optional(string(1000)) });
const panchang = shape({ tithi: lunarFactor, yoga: lunarFactor, karana: lunarFactor, weekday });
function period(level = 0) {
  const rules = {
    planet: choice(PLANETS), start: instant, end: instant, isCurrent: optional(boolean),
    fullStart: optional(instant), fullEnd: optional(instant), fullYears: optional(number(0, 120)), years: optional(number(0, 120)),
  };
  if (level < 2) {
    rules.antardashas = optional(array(period(level + 1), 20));
    rules.pratyantardashas = optional(array(period(level + 1), 20));
  }
  return shape(rules);
}
const divisionDefinition = shape({ id: string(10), factor: integer(1, 1000), label: string(200), description: optional(string(2000)), convention: optional(string(2000)) });
const divisionPositionRules = {
  id: string(10), factor: integer(1, 1000), sign: choice(SIGNS), signIndex: integer(0, 11), part: integer(1, 1000), partCount: integer(1, 1000),
  sourceLongitude: degree, sourceSignIndex: integer(0, 11), sourceDegree: number(0, 30), segmentStart: number(0, 30), segmentEnd: number(0, 30),
};
const divisionPlanet = shape({ name: choice(PLANETS), ...divisionPositionRules, house: integer(1, 12), retrograde: boolean, speedDegreesPerDay: optional(number()) });
const division = shape({ id: string(10), definition: divisionDefinition, ascendant: shape(divisionPositionRules), planets: array(divisionPlanet, 9), houses: optional(string(500)) });
const divisions = (value, path) => {
  plainData(value, path);
  const result = {};
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D7', 'D9', 'D10', 'D12', 'D16', 'D20', 'D24', 'D27', 'D30', 'D40', 'D45', 'D60']) {
    if (Object.hasOwn(value, id)) result[id] = division(value[id], `${path}.${id}`);
  }
  return result;
};
const solarDay = shape({
  date, timeZone: string(100), sunrise: nullable(instant), sunset: nullable(instant), previousSunrise: nullable(instant), nextSunrise: nullable(instant),
  vara: nullable(weekday), dayLengthSeconds: nullable(number(0, 172800)), convention: string(2000),
});
const transition = shape({ endsAt: instant, fromNumber: integer(1, 60), nextNumber: integer(1, 60) });
const panchangTransitions = shape({ tithi: transition, nakshatra: transition, yoga: transition, karana: transition, precisionSeconds: number(0, 3600), convention: string(2000) });
const results = shape({
  ayanamsa: number(0, 180), ascendant: position, planets: array(planet, 9), moonSign: choice(SIGNS), sunSign: choice(SIGNS),
  nakshatra: string(100), nakshatraPada: integer(1, 4), nakshatraLord: choice(PLANETS), panchang, dashas: array(period(), 20),
  divisions: optional(divisions), solarDay: optional(solarDay), panchangTransitions: optional(panchangTransitions),
});
const birth = shape({ date, time, utc: instant, place });
const presentation = shape({ language: choice(['en', 'hi']), style: choice(['north', 'south']), selectedDivision: string(10) });

/** Create a numerical snapshot using explicit chart fields; unknown fields are omitted. */
export function createChartRecord({ chart, name = '', language = 'en', style = 'north', selectedDivision = 'D1' } = {}) {
  plainData(chart, 'chart');
  const record = {
    format: FORMAT, schemaVersion: 1,
    calculationVersion: string(100)(chart.calculationVersion || chart.settings?.calculationVersion || 'legacy-astronomy-engine-2.1.19', 'calculationVersion'),
    subject: { name: string(100)(name, 'subject.name').trim() },
    presentation: presentation({ language, style, selectedDivision }, 'presentation'),
    birth: birth({ date: chart.date, time: chart.time, utc: chart.utc, place: chart.city }, 'birth'),
    settings: settings(chart.settings, 'settings'),
    results: results(chart, 'results'),
    notes: array(string(4000), 50)(chart.warnings || [], 'notes'),
  };
  if (record.results.planets.length !== 9 || new Set(record.results.planets.map(body => body.name)).size !== 9) error('nine planetary placements');
  const supported = record.results.divisions ? Object.keys(record.results.divisions) : ['D1', 'D9'];
  if (!supported.includes(selectedDivision)) error('presentation.selectedDivision');
  return record;
}

/** Validate and re-project a snapshot before serializing; no arbitrary extras survive. */
export function serializeChartRecord(record) {
  plainData(record, 'record');
  if (!record || record.format !== FORMAT || record.schemaVersion !== 1) error('record format or schemaVersion');
  const checkedBirth = birth(record.birth, 'birth');
  const checkedResults = results(record.results, 'results');
  const view = presentation(record.presentation, 'presentation');
  const snapshot = createChartRecord({
    chart: { ...checkedResults, date: checkedBirth.date, time: checkedBirth.time, utc: checkedBirth.utc, city: checkedBirth.place, settings: settings(record.settings, 'settings'), calculationVersion: string(100)(record.calculationVersion, 'calculationVersion'), warnings: array(string(4000), 50)(record.notes, 'notes') },
    name: shape({ name: string(100) })(record.subject, 'subject').name, ...view,
  });
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Call only from an explicit click. Embedded viewers retain their download restrictions. */
export function downloadChartRecord(record) {
  if (typeof window === 'undefined' || typeof document === 'undefined') throw new Error('Chart downloads require a browser.');
  if (window.self !== window.top) return { downloaded: false, reason: 'embedded-viewer' };
  const json = serializeChartRecord(record);
  const safeName = record.subject.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'kundali';
  const filename = `Sahni-Astrologers-${safeName}-${record.birth.date}.json`;
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.hidden = true;
  document.body.append(anchor);
  try { anchor.click(); }
  finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return { downloaded: true, filename };
}
