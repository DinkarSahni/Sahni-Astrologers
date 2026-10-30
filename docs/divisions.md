# Divisional chart conventions

`public/chart-divisions.js` allocates the calculated **sidereal** ascendant and planetary longitudes to sixteen divisional sign charts. It is original application code implementing mathematical allocation rules; no remote service or additional calculation package is used.

The selected conventions are stated below so another chart can be compared using matching settings. The term “Parashari” does not establish that every modern package chooses the same variant. In particular Hora, Drekkana, Trimsamsa and Shashtyamsa have alternative methods in circulation.

## Allocation rules

Parts are counted forward unless stated otherwise. “Odd signs” are Aries, Gemini, Leo, Libra, Sagittarius and Aquarius, using the traditional one-based sign numbering. Movable signs are Aries/Cancer/Libra/Capricorn; fixed signs Taurus/Leo/Scorpio/Aquarius; dual signs Gemini/Virgo/Sagittarius/Pisces.

| Chart | Name | Implemented sign allocation |
| --- | --- | --- |
| D1 | Rasi | Original sidereal zodiac sign. |
| D2 | Hora | First/second 15°: Leo/Cancer in odd signs, Cancer/Leo in even signs. This is the Sun/Moon Hora method. |
| D3 | Drekkana | Three 10° parts: natal sign, its fifth, its ninth. |
| D4 | Chaturthamsa | Four 7°30′ parts: natal sign, its fourth, seventh and tenth. |
| D7 | Saptamsa | Seven equal parts. Start from the natal sign in odd signs and its seventh in even signs. |
| D9 | Navamsa | Nine 3°20′ parts. Start from the natal sign in movable signs, its ninth in fixed signs and its fifth in dual signs. |
| D10 | Dasamsa | Ten 3° parts. Start from the natal sign in odd signs and its ninth in even signs. |
| D12 | Dvadasamsa | Twelve 2°30′ parts. Start from the natal sign. |
| D16 | Shodasamsa | Sixteen equal parts. Start from Aries/Leo/Sagittarius for movable/fixed/dual signs. |
| D20 | Vimsamsa | Twenty equal parts. Start from Aries/Sagittarius/Leo for movable/fixed/dual signs. |
| D24 | Chaturvimsamsa | Twenty-four equal parts. Start from Leo in odd signs, Cancer in even signs. No even-sign reversal. |
| D27 | Bhamsa | Twenty-seven equal parts. Start from Aries/Cancer/Libra/Capricorn for fire/earth/air/water signs. |
| D30 | Trimsamsa | Five unequal segments, specified below. It is not a 30-fold harmonic. |
| D40 | Khavedamsa | Forty equal parts. Start from Aries in odd signs and Libra in even signs. |
| D45 | Akshavedamsa | Forty-five equal parts. Start from Aries/Leo/Sagittarius for movable/fixed/dual signs. |
| D60 | Shashtyamsa | Sixty 0°30′ parts. **From-natal-sign variant:** start from the natal sign, count forward, with no even-sign reversal. It is not the from-Aries/cyclic variant or a Shashtyamsa deity table. |

The D30 segments are half-open: the lower endpoint belongs to the segment and the upper endpoint to the next segment.

| Natal sign parity | 0–5° | 5–10° / 5–12° | 10–18° / 12–20° | 18–25° / 20–25° | 25–30° |
| --- | --- | --- | --- | --- | --- |
| Odd | Aries | Aquarius, 5–10° | Sagittarius, 10–18° | Gemini, 18–25° | Libra |
| Even | Taurus | Virgo, 5–12° | Pisces, 12–20° | Capricorn, 20–25° | Scorpio |

For each division, the divided ascendant defines house 1 and planets receive whole-sign house numbers relative to it. These are divisional whole-sign houses; they are not a Bhava Chalit calculation.

## Precision and presentation

The output gives divisional **signs and houses**. It does not fabricate a new astronomical longitude, planetary speed or nakshatra in the divisional chart. Natal source longitudes and original records remain available separately. Retrograde markers and speed, when supplied, refer to the original birth-instant motion.

Equal-part boundaries use a small floating-point arithmetic correction when natal-sign subtraction falls a few machine units below an exact rational cusp. Values materially before a cusp remain in the preceding part; the correction never carries a position into the next natal sign.

Fine divisions, particularly D40/D45/D60, can change with small errors in recorded birth time or birthplace, and with a different ephemeris or ayanamsa near a boundary. Their presence is not a claim that an approximate or uncertain birth record supports that precision. Interpretation remains the practitioner's work.

## References and validation

The allocation rule family is described in *Brihat Parashara Hora Shastra*, the section commonly titled “The Sixteen Divisions of a Sign” (chapter numbering and transliteration vary by edition), and P. V. R. Narasimha Rao's *Vedic Astrology: An Integrated Approach*, the discussion of divisional charts. The documentation of the independent [PyJHora divisional methods](https://github.com/naturalstupid/PyJHora/blob/main/src/jhora/horoscope/chart/charts.py) was consulted to check named method variants, including the distinction between D60 from the natal sign and from Aries. No PyJHora code or dependency is included in this website.

Tests use fixed, independently hand-worked examples spanning odd/even signs, all modalities and several elements; explicit Hora and unequal Trimsamsa boundaries; fractional-cusp arithmetic; and the existing independent Swiss/Moshier J2000 reference for D9. They also verify house numbering from each divided ascendant, preservation of natal data, invalid-input rejection, and angle normalization. These tests establish the stated rules; they do not establish that the defaults match every astrology program or school.

## Integration

- `divisionDefinitions`: immutable descriptions for the sixteen factors.
- `divisionalPosition(longitude, id)`: a sign allocation with part, source longitude/sign/degree and segment bounds. `part` is one-based; sign indices are zero-based. D30 has `partCount: 5`.
- `calculateDivisions(ascendantLongitude, planets)`: an object keyed by chart ID, containing the definition, divided ascendant, planetary allocations and whole-sign houses. Each planetary record includes its original natal record under `natal`.

Only explicitly supported IDs are accepted. Unknown IDs, non-numeric/non-finite longitudes, empty planetary lists and repeated planetary names are rejected; nothing is substituted with a default chart or place.
