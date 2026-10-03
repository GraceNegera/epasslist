# Migration status: Supabase -> Neon

The project is PostgreSQL-based, so the application does not need a Supabase SDK. Database access uses the standard `pg` driver and environment variables.

Because the current Supabase staff project was newly created and contains schema/seed site data rather than production passport data, the clean migration is schema recreation rather than data migration:

1. Create Neon `epasslist-staff`.
2. Run `db/staff/schema.sql`.
3. Verify `staff.sites`, `staff.users`, `staff.passports`, and `staff.audit_logs`.
4. Create Neon `epasslist-public`.
5. Run `db/public/schema.sql`.
6. Verify `public_passport.passports` and `public_passport.sync_runs`.
7. Put the two Neon connection strings into Render secrets.
8. Test staff API health and login.
9. Test public API health/search.
10. Run the sync service with a small test dataset before importing real data.

Do not copy database passwords into GitHub, Vercel, or this ZIP.
