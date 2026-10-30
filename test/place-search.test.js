import test from 'node:test';
import assert from 'node:assert/strict';
import { cities, indiaRegions, placeCoverage, searchCities } from '../public/chart-cities.js';

const expectedRegions = ['Andaman and Nicobar Islands','Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chandigarh','Chhattisgarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Goa','Gujarat','Haryana','Himachal Pradesh','Jammu and Kashmir','Jharkhand','Karnataka','Kerala','Ladakh','Lakshadweep','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Puducherry','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal'];

test('offline gazetteer includes populated places in all 36 Indian states and union territories', () => {
  assert.deepEqual([...indiaRegions].sort(), [...expectedRegions].sort());
  assert.equal(placeCoverage.regions, 36);
  assert.equal(placeCoverage.sourceRecords, 7073);
  assert.ok(placeCoverage.indiaPlaces > 7000);
  for (const state of expectedRegions) {
    const places = searchCities('', { state, limit: 100 });
    assert.ok(places.length > 0, `${state} has no selectable places`);
    assert.ok(places.every(place => place.region === state && place.country === 'IN'));
  }
});

test('every place has a unique stable ID, finite coordinates, timezone and a qualified label', () => {
  assert.equal(new Set(cities.map(place => place.id)).size, cities.length);
  assert.equal(new Set(cities.map(place => place.name)).size, cities.length, 'Even same-name, same-district places need distinct visible labels');
  for (const place of cities) {
    assert.ok(place.name && place.placeName && place.id);
    assert.ok(Number.isFinite(place.lat) && Math.abs(place.lat) <= 90);
    assert.ok(Number.isFinite(place.lon) && Math.abs(place.lon) <= 180);
    assert.ok(place.lat !== 0 || place.lon !== 0);
    if (place.country === 'IN') {
      assert.ok(place.lat >= 6 && place.lat <= 38 && place.lon >= 68 && place.lon <= 98);
      assert.equal(place.timeZone, 'Asia/Kolkata');
      assert.ok(place.name.includes(place.region));
    }
  }
});

test('accent-insensitive search disambiguates Srinagar by state and keeps the actual coordinates', () => {
  const matches = searchCities('Srinagar', { limit: 100 });
  assert.ok(matches.some(place => place.region === 'Jammu and Kashmir'));
  assert.ok(matches.some(place => place.region === 'Uttarakhand'));
  const uttarakhand = searchCities('srinagar uttarakhand');
  assert.ok(uttarakhand.length);
  assert.ok(uttarakhand.every(place => place.region === 'Uttarakhand'));
  assert.ok(uttarakhand[0].lat < 31);
  assert.notEqual(uttarakhand[0].id, 'srinagar');
  const jammu = cities.find(place => place.id === 'srinagar');
  assert.ok(jammu.lat > 34);
});

test('duplicate Rampur names remain distinct and district/state-qualified', () => {
  const matches = searchCities('rampur', { limit: 100 }).filter(place => /^r[aā]mpur$/i.test(place.placeName));
  assert.ok(matches.length > 2);
  assert.ok(new Set(matches.map(place => place.region)).size > 1);
  assert.ok(new Set(matches.map(place => place.district)).size > 1);
  assert.equal(new Set(matches.map(place => place.id)).size, matches.length);
  assert.ok(matches.every(place => place.name.includes(place.region)));
});

test('common former names and selected Hindi/Punjabi names find the intended cities', () => {
  for (const [query, id] of [['Bombay','mumbai'], ['Calcutta','kolkata'], ['Madras','chennai'], ['Bangalore','bengaluru'], ['Trivandrum','thiruvananthapuram'], ['जालंधर','jalandhar'], ['ਜਲੰਧਰ','jalandhar']]) {
    assert.equal(searchCities(query)[0]?.id, id, query);
  }
  assert.ok(searchCities('Sri Vijaya Puram')[0]?.region === 'Andaman and Nicobar Islands');
  assert.ok(searchCities('Prayagraj')[0]);
});

test('search does not substitute a city when the name or state is unknown', () => {
  assert.deepEqual(searchCities('not-a-real-birth-city-zzzz'), []);
  assert.deepEqual(searchCities('Jalandhar', { state: 'not-a-real-state' }), []);
  assert.deepEqual(searchCities('Jalandhar', { state: 'Kerala' }), []);
  assert.ok(searchCities('a', { limit: 10000 }).length <= 100);
});

test('legacy places and overseas timezone support remain available', () => {
  const expected = { jalandhar: [31.326,75.5762,'Asia/Kolkata'], 'new-york': [40.7128,-74.006,'America/New_York'], london: [51.5074,-.1278,'Europe/London'] };
  for (const [id, values] of Object.entries(expected)) {
    const place = cities.find(candidate => candidate.id === id);
    assert.ok(place);
    assert.deepEqual([place.lat,place.lon,place.timeZone], values);
  }
  assert.equal(searchCities('New York')[0]?.id, 'new-york');
});
