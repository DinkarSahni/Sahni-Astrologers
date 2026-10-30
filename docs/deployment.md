# Deploy the website

## Architecture

Serve the frontend and `/api` routes from the same Node.js process and public domain. A static-only upload cannot run payment verification, protect administrator records, or preserve shared appointment availability.

Use a host supporting Node.js 24, HTTPS, environment secrets, and a persistent disk. Mount the SQLite database outside the public directory. A typical managed-host deployment uses:

```text
Build: npm ci && npm run build
Start: npm start
Runtime: Node.js 24
Instances: 1
Persistent database: a writable mounted disk
```

Do not run several independent application instances against separate local databases. Do not put SQLite on an unreliable shared/network filesystem. A service with ephemeral storage will lose bookings when it restarts; connect a durable disk before enabling payments. Higher availability needs a shared production database and a separate migration, rather than extra instances of this SQLite configuration.

Use different `DATA_DIR` directories (or Docker volumes) for Razorpay test and live environments. Mode isolation is enforced at startup; switching credentials must not make test payments appear to be real bookings.

Set `NODE_ENV=production`, an exact HTTPS `SITE_URL`, payment and administrator secrets, and `DATA_DIR` to the mounted private directory. The filename is `sahni.sqlite` inside that directory. Keep runtime values in the host's encrypted settings. Set `TRUST_PROXY=1` only when a single trusted reverse proxy is the application's only network entry point; otherwise keep `0`. Broad proxy trust lets forged forwarding headers undermine rate limits and cookie handling.

## Search discovery

With a production HTTPS `SITE_URL`, public pages emit route-specific titles/descriptions, canonical URLs, and local-business microdata. `/sitemap.xml` lists the public pages and five service pages; `/robots.txt` excludes booking and administrative/API paths. Development, local, and reserved test origins remain `noindex` and do not advertise a public sitemap or guessed domain. These directives guide crawlers and do not replace access controls. Confirm the final origin before sharing the public website, and submit its sitemap in the owner’s Google Search Console account after launch.

## Docker with automatic HTTPS

The supplied Dockerfile runs the application as the non-root `node` user. `compose.yaml` keeps the application port internal and exposes Caddy on ports 80 and 443. Named volumes preserve the application database and Caddy certificates.

1. Point the domain's DNS records at the deployment server. Ensure ports 80 and 443 reach it, and remove incorrect IPv6 records if the server has no working IPv6.
2. Copy `.env.example` to `.env`; set `APP_DOMAIN`, `ACME_EMAIL`, the administrator password hash, and applicable runtime credentials. `APP_DOMAIN` is a hostname without a scheme or path.
3. Build and start:

   ```sh
   docker compose build
   docker compose up -d
   docker compose logs --tail=100 app
   docker compose logs --tail=100 proxy
   ```

4. Check the public HTTPS homepage, the administrator login, and the booking flow. HTTP should redirect to HTTPS. Configure Razorpay against the HTTPS webhook endpoint only.
5. Restart the application and verify that a test booking and contact message are still present.

Do not expose port 3000 publicly when using this compose configuration. Caddy is the only trusted hop. Do not publish `.env`, database files, logs, or backups through the web server.

`docker compose down` preserves named volumes. **`docker compose down -v` deletes them**, including booking data and certificates. Never use it as a routine update command.

## Updates and recovery

Before updating, make and verify a database backup, record the deployed commit and Node version, then run the project's build and tests. Deploy during a quiet period, verify payment and booking routes, and retain the preceding image until the release is checked. Do not roll an older application over a database with incompatible schema changes without a recovery plan.

SQLite may hold recent transactions in its `-wal` file. Copying only the main database file while the service runs is not a reliable backup. Use the supplied online backup tool, which creates a consistent private copy and runs SQLite's integrity check:

```sh
node --env-file-if-exists=.env scripts/backup.mjs /private-backups/sahni-YYYY-MM-DD.sqlite
```

Choose a new filename each run; the tool refuses to overwrite a file or write into the served public directory. Store backups encrypted outside the web directory and outside the server's failure domain; test restoring a copy to a separate database before depending on the backup.

For Docker, create the online backup inside the protected application volume, then copy it to protected off-server storage:

```sh
docker compose exec app node scripts/backup.mjs /app/data/backups/sahni-YYYY-MM-DD.sqlite
```

This example assumes `DATA_DIR=/app/data`, as in the supplied compose file. Substitute the actual date and a distinct filename for each backup. The application may stay running during the online backup. A copy in the same volume is only an intermediate step; losing the server would also lose that copy.

## Release gate

- Correct domain, HTTPS, durable storage, restart persistence, and backup restore checked.
- Business details and policies approved by the business owner; no placeholder analytics or payment credentials.
- Administrator login and logout verified on HTTPS; access from a fresh browser is rejected.
- Contact messages appear in the protected inbox.
- Razorpay test payments and signed webhook events checked as described in the payment guide.
- Live credentials and webhook are separate from test credentials; no live payment has been claimed from simulated tests.
- Birth-chart settings and representative outputs reviewed by the astrologer.

Deployment configuration is supplied for review. A local test run does not establish that a particular host, public domain, merchant account, or live webhook has been configured.
