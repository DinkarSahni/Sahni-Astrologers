# Offline India birth-place gazetteer

The chart picker searches **7,074 Indian places across all 28 states and 8 union territories**. Six previously supported overseas cities remain available. A selected record carries its own latitude, longitude, and IANA timezone; no place is silently replaced by Jalandhar or by the first search result.

The underlying source contains 7,073 Indian populated-place records. The application preserves the original 37 Indian city records and their stable IDs/coordinates, merges 36 matching source records, and keeps one additional curated place. `placeCoverage` reports the resulting totals. Indian records use `Asia/Kolkata`; conversion of a historical birth time is the calculation engine's responsibility.

## Source and attribution

India gazetteer data is adapted from **GeoNames**, <https://www.geonames.org/>, through **cities.json 1.1.65**, maintained by lutangar: <https://github.com/lutangar/cities.json>. The source is licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**: <https://creativecommons.org/licenses/by/4.0/>. The complete supplied licence is retained in [india-places-CC-BY-4.0.txt](licenses/india-places-CC-BY-4.0.txt).

The upstream dataset describes cities with population above 1,000 or seats of administrative divisions down to PPLA3. It is a populated-place gazetteer, **not a list of every Indian village, hospital, street address, or birth building**. The visible picker attribution and retained JavaScript legal comments credit this source, including in the single-file preview.

Adaptations made here:

- Filtered the world dataset to country `IN`; joined state/union-territory and district labels.
- Normalized the Andaman and Nicobar Islands label; retained all 36 current state/union-territory entries, including Ladakh and the merged Dadra and Nagar Haveli and Daman and Diu.
- Converted coordinates to numbers and added deterministic application IDs. These IDs are **not GeoNames IDs**.
- Kept the original city IDs and coordinates for compatibility; eliminated matching duplicate source records. When different coordinates share the same complete city/district/state label, both records remain and coordinates are included in their visible labels.
- Added accent-insensitive search and selected former English names, Hindi/Punjabi spellings, and modern names as search aliases. Aliases do not change a selected record's geographic coordinates. This does not provide a complete transliteration or Hindi-name database.

Gazetteer coordinates generally refer to a settlement centre and are not verified birth-building coordinates. Visitors should inspect the state/district and displayed coordinates, especially for repeated place names. A manual-coordinate option is available in the chart flow for places outside this finite gazetteer. Geographic coverage does not establish that the calculation matches another astrology service's house, ayanamsa, node, historical-clock, or other conventions.

## Reproduce the generated module

No added npm dependency or external service is needed when the website runs. The filtered data is checked in as `public/chart-india-data.js` (about 422 KiB before compression); the build bundles it for the offline HTML.

Using Node.js 24 and npm, acquire the exact archive and run the generator:

```sh
npm pack cities.json@1.1.65 --pack-destination /tmp
node scripts/generate-india-places.mjs /tmp/cities.json-1.1.65.tgz
node --test test/place-search.test.js
```

The generator verifies the npm-published archive's full SHA-512 digest before reading data, then validates record counts, unique IDs, numeric coordinate bounds, and coverage of all 36 regions. It extracts only named archive members to memory, then writes the India module and licence file. It never installs or executes package scripts.

Pinned source archive:

- URL: `https://registry.npmjs.org/cities.json/-/cities.json-1.1.65.tgz`
- SHA-512 (base64): `V3BR0kpwFG0OA5Pvsc5sF1/ENtKyweeFIDhyRIoF8p7UTZWxbfiyHXzpy/v0TxYZOHgD4ykXGWVHqUt56IwDFg==`

Updating this snapshot is an explicit maintenance change: choose a new published source version, verify its licence and archive digest, review record/state changes, regenerate, and rerun tests. Do not bypass the checksum or merely overwrite the expected count to accept unexplained source changes.

## Search API

`public/chart-cities.js` exports:

- `cities`: immutable records with `id`, qualified `name`, `placeName`, `region`, `district`, `country`, `lat`, `lon`, `timeZone`, aliases, and provenance.
- `searchCities(query, { limit = 60, state = '' })`: on-device search returning at most 100 records. Every query token must match the name, district, state, or supported aliases. Exact names rank before partial matches. `state` restricts results to the named state/union territory.
- `indiaRegions`: the 36 supported state/union-territory labels.
- `placeCoverage`: India and total place counts, source version and licence.

Search text alone never calculates a chart: the visitor must select a result or deliberately enter a manual location. Unknown names or state filters return no matches.
