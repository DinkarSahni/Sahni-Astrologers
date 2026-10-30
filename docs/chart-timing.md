# Solar events and birth-time Panchang timing

`public/chart-timing.js` calculates solar events and the next change of each of four lunar factors entirely on the device. It uses the already bundled MIT-licensed Astronomy Engine. No geocoding, ephemeris API, live weather service, or additional runtime dependency is used.

## Sunrise, sunset, and Vara

`calculateSolarDay(birthUTC, location)` accepts an absolute birth instant and the selected place's numeric `lat`, `lon`, and IANA `timeZone`. The local birth date is resolved through the browser's civil-time database, including daylight-saving and historical offsets. The search does not assume that every local day lasts 24 hours or that all Indian records use today's UTC+05:30 offset.

Solar events use a **sea-level observer, the apparent upper limb of the Sun, and Astronomy Engine's standard 34-arcminute refraction**. This is an explicit astronomical convention. It is not a terrain survey, elevation-aware hospital horizon, forecast of actual observed sunlight, or a claim to match every Panchang's sunrise convention. Mountains, buildings, current pressure, humidity, and temperature are not included. Software using the solar centre, no refraction, observer elevation, or a different horizon convention will give different times.

Vara is the weekday of the most recent sunrise at or before birth. A Saturday birth before Saturday's sunrise therefore has Friday's sunrise-based Vara even though its civil weekday is Saturday. Both concepts should remain separately labelled in the result. At the exact calculated sunrise, the new Vara begins.

The return value contains:

- `date`: local birth date as `YYYY-MM-DD`.
- `timeZone`: the place's IANA timezone.
- `sunrise` and `sunset`: events on that local civil date, as UTC ISO timestamps or `null`.
- `previousSunrise`: most recent sunrise at or before birth; `nextSunrise`: first sunrise after birth.
- `vara`: `{number, name, convention}` with Sunday numbered zero, or `null` when a daily sunrise is unavailable.
- `dayLengthSeconds`: calculated interval from that date's sunrise to sunset, or `null`.
- `convention`: the explicit solar-event assumptions.

Missing polar events stay unavailable. The function never invents a sunrise, sunset, or daily Vara. The application's Indian location envelope is outside polar latitudes, but the helper also handles the previously supported overseas locations.

## Lunar-factor transitions

`calculatePanchangTransitions(birthUTC, {sunLongitude, moonLongitude})` receives the chart engine's own sidereal longitude callbacks. Passing these functions avoids an import cycle and ensures the displayed factors and transition search use the same ayanamsa and ephemeris settings.

The next boundaries strictly after birth are found for:

- Tithi: each 12° of Moon–Sun elongation, numbered 1–30.
- Nakshatra: each 13⅓° of sidereal lunar longitude, numbered 1–27.
- Yoga: each 13⅓° of the sum of sidereal solar and lunar longitudes, numbered 1–27.
- Karana: each 6° half-tithi, numbered 1–60 by its position in the lunar cycle. This ordinal is separate from the repeating/fixed Karana name.

Each returned limb is `{endsAt, fromNumber, nextNumber}`. `endsAt` is a UTC ISO timestamp. The end of the final limb wraps to number one. At an exact boundary, the search proceeds to the end of the newly started limb rather than returning the birth instant itself.

Hourly bracketing and bisection refine a root to a one-second interval. The `precisionSeconds: 1` field describes numerical search resolution; **it does not establish one-second physical or ephemeris accuracy**. The planetary model, chosen ayanamsa, and birth record still limit the result. Displaying these times to the minute is appropriate for general reference. These are next changes after the entered birth instant, not a religious calendar's complete sunrise-based date assignment, festival rule, or Muhurta judgment.

## Validation and sources

Sixteen timing tests cover sunrise-based Vara around the exact sunrise, timezones and DST, the first supported birth date's previous-year sunrise, missing polar events, invalid input, exact lunar edges, 360° wrapping, and failed/nonprogressing longitude callbacks.

Independent fixed reference values were generated outside the repository using pyswisseph 2.10.3.2 / Swiss Ephemeris 2.10.03 with Moshier calculations. The reference software is neither bundled nor required at runtime. Rise/set comparisons include Jalandhar, Great Nicobar, Itanagar, Leh, Kavaratti, New York's DST transition date, and India's 1943 wartime date. With sea-level upper-limb settings and standard atmosphere they agree within the 30-second test tolerance; this tolerance does not cover an actual site's weather or horizon.

Independent Panchang roots use apparent geocentric longitudes and Lahiri sidereal mode at J2000, the April 2024 new Moon, the March 2024 full Moon, and a 1943 birth instant. The four limb roots agree within a 90-second tolerance. These comparisons do not establish equality with every astrology package or its selected settings.

Algorithm reference: Astronomy Engine's [`SearchRiseSet`](https://github.com/cosinekitty/astronomy/blob/master/source/js/astronomy.ts) documentation, retained in the bundled library, specifies solar angular-radius and standard-refraction corrections. The module's own code states the exact lunar boundary definitions above.
