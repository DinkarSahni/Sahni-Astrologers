import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateChart, normalizeDegrees, tropicalLongitude, lahiriAyanamsa } from '../public/chart-engine.js';
import { calculateDivisions } from '../public/chart-divisions.js';
import { calculateSolarDay, calculatePanchangTransitions } from '../public/chart-timing.js';
import { createChartRecord, serializeChartRecord, downloadChartRecord } from '../public/chart-record.js';

function numericalChart() {
  const chart = calculateChart({ date: '2000-01-01', time: '17:30:45', cityId: 'jalandhar', now: new Date('2026-10-29T00:00:00Z') });
  chart.divisions ||= calculateDivisions(chart.ascendant.longitude, chart.planets);
  return chart;
}

test('chart snapshot round-trips the actual birth, numerical settings, divisions and three-level periods', () => {
  const chart = numericalChart();
  const record = createChartRecord({ chart, name: 'A family birth record', language: 'hi', style: 'south', selectedDivision: 'D30' });
  const parsed = JSON.parse(serializeChartRecord(record));
  assert.deepEqual(parsed, record);
  assert.equal(parsed.birth.utc, '2000-01-01T12:00:45.000Z');
  assert.equal(parsed.birth.place.lat, 31.326);
  assert.equal(parsed.calculationVersion, chart.calculationVersion);
  assert.equal(parsed.settings.nodeMode, chart.settings.nodeMode);
  assert.equal(parsed.results.divisions.D30.ascendant.partCount, 5);
  assert.equal(parsed.results.divisions.D9.planets.length, 9);
  assert.equal(parsed.results.dashas[0].antardashas[0].pratyantardashas[0].start, chart.dashas[0].antardashas[0].pratyantardashas[0].start);
  assert.equal(parsed.results.planets[0].longitude, chart.planets[0].longitude);
});

test('export whitelists chart fields and does not include injected booking, contact or provider values', () => {
  const chart = numericalChart();
  chart.accessToken = 'private-token-must-not-export';
  chart.booking = { email: 'private@example.invalid' };
  chart.city = { ...chart.city, secret: 'place-extra-secret' };
  chart.settings = { ...chart.settings, razorpayKeySecret: 'gateway-secret' };
  chart.planets[0] = { ...chart.planets[0], customerPhone: 'private-phone' };
  const record = createChartRecord({ chart, name: '<script>plain text name</script>' });
  record.injected = { session: 'private-session' };
  record.birth.place.injected = 'extra-place-value';
  const json = serializeChartRecord(record);
  for (const forbidden of ['private-token', 'private@example', 'place-extra-secret', 'gateway-secret', 'private-phone', 'private-session', 'extra-place-value']) assert.ok(!json.includes(forbidden));
  assert.equal(JSON.parse(json).subject.name, '<script>plain text name</script>');
});

test('solar and lunar transition snapshots retain their computed times and explicit conventions', () => {
  const chart = numericalChart();
  const atBirth = new Date(chart.utc);
  chart.solarDay = calculateSolarDay(atBirth, chart.city);
  chart.panchangTransitions = calculatePanchangTransitions(atBirth, {
    sunLongitude: instant => normalizeDegrees(tropicalLongitude('Sun', instant) - lahiriAyanamsa(instant)),
    moonLongitude: instant => normalizeDegrees(tropicalLongitude('Moon', instant) - lahiriAyanamsa(instant)),
  });
  const snapshot = JSON.parse(serializeChartRecord(createChartRecord({ chart })));
  assert.deepEqual(snapshot.results.solarDay, chart.solarDay);
  assert.deepEqual(snapshot.results.panchangTransitions, chart.panchangTransitions);
  assert.ok(snapshot.results.solarDay.previousSunrise <= snapshot.birth.utc);
  assert.ok(snapshot.results.panchangTransitions.tithi.endsAt > snapshot.birth.utc);
});

test('non-finite or missing numerical values cannot silently become JSON null', () => {
  for (const invalid of [NaN, Infinity, -Infinity, undefined]) {
    const chart = numericalChart();
    chart.ayanamsa = invalid;
    assert.throws(() => createChartRecord({ chart }), /invalid results.ayanamsa/);
  }
  const record = createChartRecord({ chart: numericalChart() });
  record.results.divisions.D60.ascendant.sourceLongitude = NaN;
  assert.throws(() => serializeChartRecord(record), /sourceLongitude/);
  const sparse = numericalChart();
  delete sparse.planets[0];
  assert.throws(() => createChartRecord({ chart: sparse }), /results.planets\[0\]/);
});

test('unsupported schema, missing bodies, invalid presentation and executable object shapes are rejected', () => {
  const chart = numericalChart();
  assert.throws(() => createChartRecord({ chart, selectedDivision: 'D99' }), /selectedDivision/);
  assert.throws(() => createChartRecord({ chart, style: 'unimplemented' }), /presentation.style/);
  const short = { ...chart, planets: chart.planets.slice(1) };
  assert.throws(() => createChartRecord({ chart: short }), /nine planetary/);
  const record = createChartRecord({ chart });
  assert.throws(() => serializeChartRecord({ ...record, schemaVersion: 2 }), /schemaVersion/);
  let getterCalled = false;
  const executable = { ...chart, get utc() { getterCalled = true; return chart.utc; } };
  assert.throws(() => createChartRecord({ chart: executable }), /invalid chart/);
  assert.equal(getterCalled, false);
  assert.throws(() => createChartRecord({ chart: Object.assign(Object.create({ inherited: true }), chart) }), /invalid chart/);
});

test('embedded viewers are left in control of download permissions', () => {
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  try {
    globalThis.window = { self: {}, top: {} };
    globalThis.document = { createElement() { throw new Error('Must not initiate a download'); } };
    assert.deepEqual(downloadChartRecord(createChartRecord({ chart: numericalChart() })), { downloaded: false, reason: 'embedded-viewer' });
  } finally {
    if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  }
});

test('explicit top-level download uses a safe JSON filename and cleans up the temporary URL', async () => {
  const original = { window: globalThis.window, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL, timeout: globalThis.setTimeout };
  let capturedBlob, cleanup, clicked = false, appended = false, removed = false, revoked;
  const anchor = { click() { clicked = true; }, remove() { removed = true; } };
  try {
    const top = {}; globalThis.window = { self: top, top };
    globalThis.document = { createElement(tag) { assert.equal(tag, 'a'); return anchor; }, body: { append(value) { assert.equal(value, anchor); appended = true; } } };
    URL.createObjectURL = blob => { capturedBlob = blob; return 'blob:chart-record-test'; };
    URL.revokeObjectURL = url => { revoked = url; };
    globalThis.setTimeout = callback => { cleanup = callback; return 1; };
    const result = downloadChartRecord(createChartRecord({ chart: numericalChart(), name: '../../my <record>' }));
    assert.equal(result.downloaded, true);
    assert.equal(result.filename, 'Sahni-Astrologers-my-record-2000-01-01.json');
    assert.equal(anchor.download, result.filename);
    assert.equal(anchor.href, 'blob:chart-record-test');
    assert.equal(capturedBlob.type, 'application/json;charset=utf-8');
    assert.equal(JSON.parse(await capturedBlob.text()).birth.utc, '2000-01-01T12:00:45.000Z');
    assert.ok(clicked && appended && removed);
    cleanup(); assert.equal(revoked, 'blob:chart-record-test');
  } finally {
    URL.createObjectURL = original.create; URL.revokeObjectURL = original.revoke; globalThis.setTimeout = original.timeout;
    if (original.window === undefined) delete globalThis.window; else globalThis.window = original.window;
    if (original.document === undefined) delete globalThis.document; else globalThis.document = original.document;
  }
});
