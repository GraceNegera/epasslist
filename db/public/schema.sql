CREATE SCHEMA IF NOT EXISTS public_passport;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public_passport.passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arn VARCHAR(80) UNIQUE NOT NULL,
  full_name VARCHAR(250) NOT NULL,
  passport_number VARCHAR(100),
  branch_code VARCHAR(50),
  branch_name VARCHAR(150),
  arrival_date DATE,
  public_status VARCHAR(30) NOT NULL DEFAULT 'Not Collected' CHECK (public_status IN ('Collected','Not Collected')),
  collected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS public_passports_arn_idx ON public_passport.passports(arn);
CREATE INDEX IF NOT EXISTS public_passports_name_idx ON public_passport.passports(LOWER(full_name));
CREATE INDEX IF NOT EXISTS public_passports_passport_idx ON public_passport.passports(passport_number);
CREATE INDEX IF NOT EXISTS public_passports_branch_idx ON public_passport.passports(branch_code);

CREATE TABLE IF NOT EXISTS public_passport.sync_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  rows_seen INTEGER NOT NULL DEFAULT 0,
  rows_upserted INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  error_message TEXT
);
