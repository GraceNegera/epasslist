# Neon setup for ePassList

This project uses two separate Neon PostgreSQL projects:

- `epasslist-staff` — private operational database
- `epasslist-public` — applicant-facing database containing only approved public fields

## 1. Create the Staff project

In Neon, create a project named `epasslist-staff`. Choose a region close to the Render services you will use. Neon Free currently provides 1 GB PostgreSQL storage per project.

Copy the pooled PostgreSQL connection string. Keep it secret. It normally looks like:

```text
postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
```

## 2. Install the Staff schema

Open Neon SQL Editor for `epasslist-staff` and run:

```text
db/staff/schema.sql
```

Verify:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'staff'
ORDER BY table_name;
```

Expected tables:

- `staff.audit_logs`
- `staff.passports`
- `staff.sites`
- `staff.users`

Verify sites:

```sql
SELECT * FROM staff.sites ORDER BY code;
```

## 3. Create the Public project

Create a second Neon project named `epasslist-public`.

Run:

```text
db/public/schema.sql
```

Verify:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public_passport'
ORDER BY table_name;
```

Expected tables:

- `public_passport.passports`
- `public_passport.sync_runs`

## 4. Render secrets

Staff API:

```text
STAFF_DATABASE_URL=<pooled Neon URL for epasslist-staff>
JWT_SECRET=<long random secret>
STAFF_WEB_ORIGINS=https://adamaepass.vercel.app,https://hossanaepass.vercel.app,https://hawassaepass.vercel.app
```

Public API:

```text
PUBLIC_DATABASE_URL=<pooled Neon URL for epasslist-public>
PUBLIC_WEB_ORIGIN=https://epassport.vercel.app
SYNC_SECRET=<long random secret>
```

Sync service:

```text
STAFF_DATABASE_URL=<pooled Neon URL for epasslist-staff>
PUBLIC_DATABASE_URL=<pooled Neon URL for epasslist-public>
BATCH_SIZE=1000
```

Never put either database URL in Vercel frontend environment variables.

## 5. Important free-plan note

Neon Free is suitable for development and early deployment, but monitor storage, compute hours, and traffic. If this system becomes a high-volume production service, review the current Neon limits and move to a paid/reliable tier when required.

## 6. Moving from the Supabase project

The previous Supabase `epasslist-staff` project was only used to create and verify the schema. If it contains no real production data, no data export/import is required. Simply recreate the schema in the Neon Staff project and use the Neon connection string from then on. Keep the Supabase project until the Neon setup has been tested successfully; delete it only after verification.
