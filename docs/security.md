# Security and personal data

No website can promise immunity from every attack. This application limits trust in the browser, verifies payment evidence with Razorpay, and avoids introducing a public way to mark a booking paid. Operational choices remain part of its security.

## Administrator access

Generate a long, unique password with a password manager and run `npm run admin:password` to create its scrypt hash. Set only the hash in `ADMIN_PASSWORD_HASH`. The password prompt must not echo the password or put it into shell history. Do not reuse a Razorpay or email password.

Serve the administrator area only over HTTPS in production. Session cookies are HTTP-only, use same-site protection, and must be Secure in production. Log out on shared devices. Administrator authentication does not replace protecting the server, host dashboard, and Razorpay account; enable account MFA at those providers.

If an administrator password or payment secret is exposed, rotate it and invalidate active sessions as appropriate. Keep an incident record without copying the leaked value into the record.

## Data minimisation

Birth-chart input is calculated in the visitor's browser. It is not sent to an AI provider or chart API. Deliberately booking a reading sends the entered consultation details to the server. Opening a WhatsApp link may include those details in a draft; the visitor chooses whether to send it.

The server retains appointment and contact information so the business can fulfil the request. Payment metadata should contain a booking reference, rather than birth details or free-text notes. The site does not collect card numbers or bank credentials. Razorpay handles its own checkout data under its terms.

Choose and document retention periods with the business owner and applicable accounting obligations. Delete unneeded enquiry and birth-detail records; retain only the payment/accounting records that are necessary. Apply the same schedule to encrypted backups. Do not claim a specific legal retention period merely because a template mentions one.

## Deployment controls

- Keep `.env`, SQLite files, backups, and logs outside the served public directory. Git ignore rules help prevent accidental commits but are not an access-control boundary.
- Expose only the HTTPS reverse proxy. Trust precisely the proxy topology you deploy; do not accept forwarding headers from arbitrary direct clients.
- Keep dependency locks and Node.js patched. Run build, automated tests, and a dependency audit before release; review breaking changes rather than installing blindly on production.
- Maintain the Content Security Policy. The public UI uses external JavaScript and text rendering; avoid reintroducing inline handlers, arbitrary HTML injection, or permissive wildcard script sources.
- Back up the database consistently and test recovery. Protect backups as carefully as the live database.
- Rate limits reduce abuse but do not stop all distributed attacks. Use host-level traffic controls and monitoring if traffic or abuse grows.

## Release verification limits

Local tests cannot certify merchant onboarding, live settlement, a production network boundary, legal compliance, or the precision of every historical chart. Check the deployment and payment acceptance scenarios on the actual HTTPS host. Have the business owner approve published claims, prices, policies, photographs, and interpretation text.
