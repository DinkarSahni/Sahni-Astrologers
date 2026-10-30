# Third-party notices

This project uses independently maintained packages. Keep their notices and licence files when distributing copies. The authoritative versions are locked in `package-lock.json`; review installed package licence metadata when updating.

- **Astronomy Engine** by Don Cross, MIT licence, https://github.com/cosinekitty/astronomy. The browser build is copied from the installed package by `npm run build`. This supplies astronomical calculations; the site implements and labels its astrological conventions separately. No Swiss Ephemeris library is bundled, and there is no claim that a prompt to an AI runs Swiss Ephemeris.
- **GeoNames** place data, https://www.geonames.org/, adapted from **cities.json 1.1.65** under CC BY 4.0. The India subset is bundled for offline place search. Attribution, changes, checksum-pinned regeneration, coverage limits, and the full licence are recorded in [India place sources](india-places.md). Dataset legal comments remain in the standalone preview.
- **Express**, **Helmet**, **express-rate-limit**, **Axios**, and **Zod** are used for the web server, request protection, provider HTTP requests, and validation. Their licence terms are included with their installed packages.
- **Razorpay Checkout** is loaded from Razorpay when payment is available and is governed by Razorpay's terms. It is not included as proprietary project code.
- **Node.js** supplies the runtime and SQLite API; its distribution includes its own notices.
- **Playfair Display**, **DM Sans**, **Dancing Script**, and **Noto Sans Devanagari** are locally served through their Fontsource variable-font packages under the SIL Open Font License. The build copies their licence notices alongside the served fonts; the standalone preview embeds the notices in HTML comments with the font data. They do not require Google Fonts requests.
- **esbuild** (MIT) builds the downloadable single-file preview. It is a development dependency and is not used to verify or process payments.

No licence is granted here to reuse the business's name, testimonials, or original website design. The uploaded website's business content remains the owner's material.
