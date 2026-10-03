# Deployment checklist

## 1. Databases

Create two PostgreSQL databases (or two isolated PostgreSQL projects):

- `passport_public`
- `passport_staff`

Run the matching SQL files.

For Supabase, you can use one project with two schemas for a first deployment, but if you specifically want two isolated databases, use two projects/instances and keep two separate connection strings.

## 2. Staff API

Set:

```env
STAFF_DATABASE_URL=...
JWT_SECRET=<random 32+ byte secret>
STAFF_WEB_ORIGINS=https://adamaepass.vercel.app,https://hossanaepass.vercel.app,https://hawassaepass.vercel.app
```

Run the bootstrap command once:

```bash
npm run bootstrap-admin
```

Then immediately change the admin password and create site-specific managers/supervisors/officers.

## 3. Public API

Set:

```env
PUBLIC_DATABASE_URL=...
PUBLIC_WEB_ORIGIN=https://epassport.vercel.app
SYNC_SECRET=<random secret if using internal sync endpoint>
```

## 4. Public Web

Vercel root:

```text
apps/public-web
```

Environment:

```env
VITE_PUBLIC_API_URL=https://YOUR-PUBLIC-API.onrender.com
```

## 5. Staff Web

Vercel root:

```text
apps/staff-web
```

Environment:

```env
VITE_STAFF_API_URL=https://YOUR-STAFF-API.onrender.com
```

Add every site domain to the same Vercel project.

## 6. Sync

Run:

```bash
npm run sync
```

Schedule this with a private worker/cron. For large data, increase `BATCH_SIZE` carefully.

## 7. Custom domains

For each site, add the domain to the same staff-web Vercel project. Update `siteConfig.ts` with the hostname and corresponding site code.

## 8. Production hardening

- Replace all development secrets.
- Restrict CORS to exact domains.
- Enable database backups.
- Put the public API behind HTTPS.
- Consider CAPTCHA/WAF controls if public searches are abused.
- Add password reset and OTP before production staff use.
- Add audit logging to every sensitive staff operation.
- Review what applicant data is legally permitted to be public.
