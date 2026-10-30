# Sahni Astrologers

A website for Sahni Astrologers, Jalandhar, with the original cream, black, and amber appearance, private browser-based birth-chart calculations, and a small Node.js server for appointments, contact messages, and Razorpay verification. No paid AI service is used.

## Open the website without installing anything

Download [Sahni-Astrologers-Website.zip](preview/Sahni-Astrologers-Website.zip), extract it, and open **index.html** in Chrome, Safari, or Edge. The archive also contains `START-HERE.txt` with these instructions. A ChatGPT file viewer may restrict styles or scripts and show an incomplete page; download the ZIP and use a full browser.

The same website is also available as [Sahni-Astrologers-Final.html](preview/Sahni-Astrologers-Final.html), with an identical `Sahni-Astrologers.html` alias for existing links. Its original styling, local fonts, navigation, and chart calculator are included in one file. It makes no background requests and works without a server. Navigation uses the address fragment so pages still work when the file is opened directly. Every preview build refreshes both HTML files and the ZIP.

This local preview cannot reserve appointments or take payments. Enquiries can be prepared as WhatsApp drafts, which the visitor must open and send. The preview never pretends that a message or payment was submitted. Use the server below for real booking records and payment verification.

Download the newly rebuilt file and open it in a full browser such as Chrome, Safari, or Edge. Some chat/file viewers disable scripts entirely or restrict printing and external links. The file also supports local charts and navigation in script-enabled restricted previews, but cannot override the viewer's permissions. Replace any earlier downloaded copy.

`public/index.html` is the server application's source entry point, with separate assets; it requires the server rather than being opened by itself. The [desktop](docs/previews/homepage-desktop.png) and [mobile](docs/previews/homepage-mobile.png) PNGs are screenshots only.

To regenerate the interactive file after changing the site, run `npm ci` followed by `npm run preview:build`. Missing styles, fonts, or script dependencies fail the preview build. The builder also parses the final embedded JavaScript before writing the HTML, so packaging corruption fails the build instead of producing an unresponsive website.

The public pages retain service comparisons and preparation guidance, shareable service filters, searchable FAQs, and phone/WhatsApp contact options. The original homepage slogan, typography, service grid, family story, and dark quote/CTA sections have been restored. Business narration now uses a consistent family-practice voice. In the server version, the numerical library loads only when a visitor calculates a chart.

The service story pins while normal vertical scrolling advances the four panels horizontally, then releases to the following page content. It works in reverse and on mobile; reduced-motion settings receive ordinary horizontal navigation with buttons. The site opens directly on the homepage, with no separate entrance screen or slide-to-enter gesture.

Tevas can be viewed and printed in English or Hindi. Language switching reuses the same numerical chart; the selected Teva order language is also stored with digital/physical orders and shown in the protected administrator area. The SA tab icon and heritage statistics keep the original visual system. The Google reviews section restores the original badge and eight full supplied reviews, with their individual star ratings, dates where supplied, and profile links. Visitors browse the horizontal card strip using arrows, keyboard or touch. Cards stay still until the visitor moves them; there is no automatic rotation or pause control. The review heading stays static, with explicit spacing that prevents its subtitle from colliding with italic descenders. No live aggregate rating or automatic Google updates are claimed.

The footer includes the full address, phone, source-backed Instagram and Google links, clear policy navigation, and a current-year copyright line. The contact page uses the confirmed visiting hours and an optional Google map; Google receives map requests only after the visitor clicks **Load Google Map**. Charts and ordinary preview navigation remain offline. Privacy, booking/refund/delivery terms, and a separate astrology/calculator disclaimer describe the actual implementation. No newsletter or unconfigured domain email is advertised. See [launch review](docs/launch-review.md) for the remaining operational work.

The Kundali form searches **7,074 Indian places across all 36 states and union territories**, with state/district labels and common older city names. Visitors select the actual result; typing a place name never silently picks a nearby city. Exact-coordinate entry covers villages or birth buildings outside the finite directory. Coordinates are displayed for verification. See [place sources and coverage](docs/india-places.md). Search runs on the device without Google geocoding or a per-search charge, and the hosted site loads this directory when the chart page opens.

Birth times support optional seconds. Results include 16 divisional charts, North/South Indian layouts, nine planetary placements, nakshatra/pada, birth-instant Panchang with next boundary times, sunrise/sunset and sunrise-based Vara, and three levels of Vimshottari periods. Mean/approximate true nodes and 365.25/360-day Dasha years are explicit choices. The visitor can print a chart or explicitly download a local JSON record with calculation version, inputs, settings and results. These are declared conventions, rather than a claim of exact agreement with every astrology package; compare known charts using matching settings before customer use. See [calculation details and reference limits](docs/calculations.md).

## Run locally

Use Node.js 24. Start in this checkout; a new Git worktree is unnecessary.

```sh
npm ci
npm run build
npm test
cp .env.example .env
npm run admin:password
```

Put the generated administrator password hash in `.env` as `ADMIN_PASSWORD_HASH`. Do not put the password itself, payment secrets, or `.env` in Git. Then start the site:

```sh
npm start
```

The terminal reports the listening address. Use the same address configured in `SITE_URL`; write requests from other origins are rejected. `npm run dev` restarts the server when backend files change.

Payments are disabled until configured. Local development does not require payment credentials. Contact messages and appointments are stored in the local SQLite database; chart input stays in the browser unless the visitor deliberately includes it in a booking or WhatsApp message.

## What is included

- Public pages for services, booking, contact, FAQs, privacy, and terms, with normal, shareable URLs.
- Date-aware birth-time conversion, nationwide place search and exact Indian coordinates, astronomical calculations, whole-sign houses, 16 divisional charts, solar/Panchang timing, and three-level Vimshottari dashas. Calculation settings and limitations are shown with the chart.
- Server-owned service prices, shared appointment reservations, and booking access tokens.
- Razorpay orders created on the server; checkout signatures and provider payment records checked before confirmation; signed webhook handling and event deduplication.
- An administrator area for reading booking and contact records. Customer payment details are handled by Razorpay, not collected by this application.
- Input validation, safe text rendering, security headers, request throttling, and protected administrator sessions.

## Before taking live payments

Read [deployment instructions](docs/deployment.md) and [payment operations](docs/payments.md). This code cannot enable your merchant account, activate a domain, create a webhook in Razorpay, or prove that a live payment has settled.

1. Confirm the business's public contact details, service prices, appointment hours, delivery promises, and refund arrangements.
2. Configure the site on HTTPS with durable database storage and backups.
3. Set a strong administrator password and keep the hash and all payment credentials in the host's secret settings.
4. Use Razorpay **test** credentials first. Test successful, failed, cancelled, delayed, duplicate, and mismatched payments and inspect the resulting booking records.
5. Configure the signed webhook in the Razorpay dashboard, then separately switch to matched **live** keys after the merchant account is approved. Perform and reconcile a small real transaction and refund before advertising online payment.

The site must never say an appointment is paid solely because a browser callback fired. Unexpected or conflicting payments require a person to reconcile them; see the operations guide.

## Costs and boundaries

The chart feature does not incur per-chart AI charges. Domain registration, payment processing, durable hosting, backups, and any future email service can still cost money. Public frontend source is visible to visitors; protecting private credentials and trusted records belongs on the server.

Contact submission creates an administrator inbox record. It does not claim that an email or WhatsApp message was automatically sent. WhatsApp links open a draft that the visitor must send. No stock image is presented as a photograph of the family or premises; genuine business photographs can be added later.

## Automated checks

`npm run check` prepares the locally served astronomy module, checks JavaScript syntax, and runs backend, numerical chart, password, and backup regression tests. The payment tests use an injected simulated gateway; the production server has no fake-payment mode.

Run the browser tests after building:

```sh
npx playwright install chromium
npm run test:e2e
```

If Chromium is already installed on the machine, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable instead of downloading another browser. The browser tests run a separate test server on port 4173, block outside services, and simulate the checkout SDK while exercising the real booking verification and database routes. They cover desktop/mobile navigation, chart privacy and injection handling, payment status recovery, and the protected inbox. Standalone tests use the actual generated file, including an opaque-origin `srcdoc` iframe with only script permission, to catch packaging, navigation, and local-action failures. GitHub Actions runs these checks on pushes and pull requests.

See [security and privacy operations](docs/security.md) for the data lifecycle and release checks, and [calculation settings](docs/calculations.md) for chart conventions and limits. Dependency licences are documented in [third-party notices](docs/third-party-notices.md).
