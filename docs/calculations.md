# Offline Kundali calculation settings

All chart calculations, place search, chart layouts, and record export run locally. No astrology, AI, geocoding, or prediction API is called. Birth details are not automatically uploaded or saved. Astronomy Engine 2.1.19 (MIT) remains the numerical library; no Swiss Ephemeris or commercial library is shipped.

## Calculation conventions

- Apparent geocentric longitudes in the true ecliptic of date, converted to a sidereal zodiac with the disclosed Lahiri precession/nutation approximation.
- Mean lunar nodes by default. The optional osculating true node uses the Moon’s position/velocity orbital plane and is explicitly approximate. Actual node direction is computed; uncertain motion near stations is marked rather than displayed as confidently direct or retrograde.
- Whole-sign natal houses. North and South Indian layouts display the same sign placements; switching layout never recalculates the birth record.
- Sixteen divisional charts: D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, and D60. Their rules are explicit in the interface and [divisional conventions](divisions.md). D2 uses Sun/Moon Hora; D30 uses unequal segments. D60 uses the documented from-natal-sign variant, with no even-sign reversal, rather than claiming every package’s default. Divisional signs do not invent new astronomical degrees or nakshatras.
- Vimshottari Mahadasha, Antardasha, and Pratyantardasha. The chosen 365.25-day or 360-day year changes actual dates. All clipped periods retain their full parent’s origin; the first period starts with the remaining birth balance. Finer tables load when opened. Displayed Dasha times are in IST.
- Birth-instant Tithi/Paksha, Nakshatra/Pada, Yoga, and Karana, plus their next calculated ending times. Local civil weekday and sunrise-based Vara are distinct. Solar rise/set uses a sea-level observer, apparent upper limb and standard refraction. Boundary times are shown to the minute; one-second numerical root resolution does not mean one-second physical accuracy. See [timing conventions](chart-timing.md).
- Dates 1900–2100, optional birth seconds, listed coordinates with IANA civil-time history, and exact Indian coordinate entry. Unknown cities are never substituted. Ambiguous/repeated or nonexistent clock times are rejected. Manual coordinates require a finite 6–38° N / 68–98° E envelope and Asia/Kolkata; this is not a geocoder or proof of political boundaries.

Every computed record carries calculation version `sahni-kundali-2.0.0` and actual settings. [Local JSON snapshots](chart-record.md) include the birth record, conventions, numerical results, divisional charts and timing. Downloads occur only after the visitor explicitly requests one.

## Independent checks and limits

Planetary longitude fixtures are checked within 0.01°, and ascendant fixtures within 0.001°, against independently generated Swiss/Moshier references. A monthly 1900–2100 audit of 2,412 samples found a maximum Lahiri difference of 0.00007152° (about 0.26 arcsecond), so the existing precession approximation was retained. The optional true-node method’s maximum sampled difference was 0.014974° (about 0.90 arcminute); fixed regressions use a 0.016° tolerance. Node-speed differences can affect direction near stations, where the interface marks uncertainty. These sampled limits are not a proof for every possible instant.

Solar fixtures cover seven location/date cases, including New York DST and India’s wartime offset, within a 30-second comparison tolerance. Panchang ending times cover four independent epochs within 90 seconds. Terrain, observer height, weather, and reference refraction conventions affect observed sunrise. The reference library was used outside the shipped application to produce comparison values, and is not a runtime dependency.

Birth-record uncertainty affects the Lagna and fine divisions, particularly D60. Compare known charts using matching node, ayanamsa, divisional convention, house system, historical-clock convention and Dasha year before customer use. The application does not claim exact equivalence to AstroSage, Parashara, or every astrologer’s chosen settings.

Asia/Kolkata follows the IANA database, including wartime UTC+06:30 and pre-1906 Kolkata mean time. It does not reconstruct every locality’s former Bombay/Calcutta or other civil-time convention. Indian birth records before 1956 receive a visible historical-time note; the original record’s convention needs professional checking.

Personal interpretation remains a consultation with Sahni Astrologers. Shadbala, Ashtakavarga, automatic Yoga/Dosha judgements, birth-time rectification, and other predictive systems are not fabricated or labelled as implemented. No medical, financial, relationship, or other outcome is guaranteed.
