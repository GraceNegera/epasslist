# Adding a new site

Example: adding Jimma.

## 1. Staff database

```sql
INSERT INTO staff.sites (code,name,city,hostname)
VALUES ('JIMMA','Jimma Immigration Office','Jimma','jimmaepass.vercel.app');
```

## 2. Staff frontend

Add one mapping in `apps/staff-web/src/siteConfig.ts`:

```ts
'jimmaepass.vercel.app': {
  code: 'JIMMA',
  name: 'Jimma Immigration Office',
  hostname: 'jimmaepass.vercel.app'
}
```

## 3. Vercel

Add `jimmaepass.vercel.app` as another domain on the same staff-web Vercel project.

## 4. DNS

Point the domain according to Vercel's current DNS instructions.

## 5. Staff accounts

Create users with the Jimma site's UUID in `staff.users.site_id`.

The same staff API and same frontend build will serve Jimma. No new application copy is required.
