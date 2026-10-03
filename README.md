# ePassList / ePassport Platform

A multi-site passport lookup and staff portal platform with two PostgreSQL databases hosted on Neon:

1. **Public DB** — only applicant-facing passport lookup data.
2. **Staff DB** — all branches, users, operational passport records, collections and audit logs.

## Architecture

```text
                       ePassport Platform
                              |
             +----------------+----------------+
             |                                 |
             v                                 v
   epassport.vercel.app                *.epass.vercel.app
      Public Web                         Staff Web
             |                                 |
             v                                 v
        Public API                         Staff API
             |                                 |
             v                                 v
        PUBLIC DB                           STAFF DB
             ^                                 |
             |                                 |
             +--------- Sync Service ----------+
```

## Apps and services

- `apps/public-web` — applicant-only website.
- `apps/staff-web` — reusable officer portal deployed to many site domains.
- `services/public-api` — public, read-only search API.
- `services/staff-api` — JWT-authenticated staff API with site isolation.
- `services/sync-service` — copies only approved public fields from staff DB to public DB.
- `db/public/schema.sql` — public DB schema.
- `db/staff/schema.sql` — staff DB schema and seed sites.
- `packages/shared` — shared types/config.

## Recommended production domains

Public:
- `https://epassport.vercel.app`

Staff portal (same Vercel project, multiple custom domains):
- `https://adamaepass.vercel.app`
- `https://hossanaepass.vercel.app`
- `https://hawassaepass.vercel.app`

The staff frontend identifies the site from the hostname. The backend never trusts the hostname for authorization; it uses the authenticated user's `site_id`.

## Security model

- Public API is read-only.
- Staff DB credentials are never sent to the browser.
- Staff API requires JWT.
- Every staff query is scoped to the authenticated user's site unless the role is `admin`.
- Passwords are stored with bcrypt.
- Public API uses rate limiting and returns a minimal response.
- Sync service uses a private shared secret.
- Do not put database URLs in Vercel frontend environment variables.

## Local setup

Requirements:
- Node.js 20+
- PostgreSQL 15+
- npm 10+

Install:

```bash
npm install
```

Create two Neon projects, one for each isolated PostgreSQL database:

```text
epasslist-staff
epasslist-public
```

Apply:

```bash
psql "$PUBLIC_DATABASE_URL" -f db/public/schema.sql
psql "$STAFF_DATABASE_URL" -f db/staff/schema.sql
```

Copy environment examples:

```bash
cp services/public-api/.env.example services/public-api/.env
cp services/staff-api/.env.example services/staff-api/.env
cp services/sync-service/.env.example services/sync-service/.env
cp apps/public-web/.env.example apps/public-web/.env
cp apps/staff-web/.env.example apps/staff-web/.env
```

Then run services separately with the scripts in the root `package.json`.

## First staff login

The current schema creates the site records only. Create the first staff account through the staff API/admin bootstrap process before production use. Do not hard-code a production password in source code.

## Import flow

The staff manager/admin can upload an Excel file. The API accepts common column names for ARN, full name, passport number and arrival date. Arrival date is set to the import date when the existing record has no arrival date, matching the operational rule used by the Adama system.

After importing, run the sync service:

```bash
npm run sync
```

For production, run it on a schedule (for example every 5–15 minutes or after every successful import).

## Production deployment

### Public API — Render

Root directory:
`services/public-api`

Build:
`npm install && npm run build`

Start:
`npm start`

### Staff API — Render

Root directory:
`services/staff-api`

Build:
`npm install && npm run build`

Start:
`npm start`

### Public Web — Vercel

Root directory:
`apps/public-web`

Environment:
`VITE_PUBLIC_API_URL=https://YOUR-PUBLIC-API.onrender.com`

### Staff Web — Vercel

Root directory:
`apps/staff-web`

Environment:
`VITE_STAFF_API_URL=https://YOUR-STAFF-API.onrender.com`

Add all staff domains to the same Vercel project. The application maps the hostname to the site code.

### Sync Service

Run as a private Render worker/cron or another scheduler. It needs both database URLs and the same `SYNC_SECRET` configured on the public API if you use the internal sync endpoint.

## Adding a new site

1. Insert a row into `staff.sites`.
2. Add its hostname mapping to `apps/staff-web/src/siteConfig.ts`.
3. Point the new domain at the existing staff-web Vercel project.
4. Create staff users assigned to the site's `site_id`.
5. No new frontend codebase is required.

## Important production hardening

Before opening this to real applicants/staff, also configure:
- HTTPS only.
- Strong random JWT secret.
- Strong random sync secret.
- Database backups and point-in-time recovery.
- CORS to exact production domains instead of `*`.
- CAPTCHA or stronger abuse controls if public traffic becomes high.
- Monitoring and error logging.
- Password reset/OTP integration.
- Data retention and privacy policy approved by the responsible organization.
