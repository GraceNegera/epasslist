# API reference

## Public API

`GET /health`

`GET /api/public/search?q=<text>&type=auto|arn|name|passport`

`GET /api/public/passport/:arn`

`POST /api/internal/sync-upsert`

The sync endpoint requires `x-sync-secret` and is intended for private service-to-service use.

## Staff API

`POST /api/auth/login`

```json
{"username":"admin","password":"..."}
```

`GET /api/auth/me`

`GET /api/passports?q=<text>&limit=100`

`POST /api/passports/:id/collect`

`POST /api/passports/import` as multipart/form-data with field `file`.

Admins must also provide a `siteId` form field when importing for a branch.

`GET /api/reports/summary`

`GET /api/sites` is admin-only.
