CREATE SCHEMA IF NOT EXISTS staff;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS staff.sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  city VARCHAR(150),
  hostname VARCHAR(255) UNIQUE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(100) UNIQUE NOT NULL,
  full_name VARCHAR(200) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin','manager','supervisor','officer')),
  site_id UUID REFERENCES staff.sites(id),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff.passports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES staff.sites(id),
  arn VARCHAR(80) NOT NULL,
  full_name VARCHAR(250) NOT NULL,
  passport_number VARCHAR(100),
  unique_code VARCHAR(20),
  arrival_date DATE,
  collection_status VARCHAR(30) NOT NULL DEFAULT 'Not Collected' CHECK (collection_status IN ('Collected','Not Collected')),
  collected_by UUID REFERENCES staff.users(id),
  collected_at TIMESTAMPTZ,
  source_row JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, arn)
);

CREATE INDEX IF NOT EXISTS passports_site_idx ON staff.passports(site_id);
CREATE INDEX IF NOT EXISTS passports_arn_idx ON staff.passports(arn);
CREATE INDEX IF NOT EXISTS passports_name_lower_idx ON staff.passports(LOWER(full_name));
CREATE INDEX IF NOT EXISTS passports_status_idx ON staff.passports(collection_status);
CREATE INDEX IF NOT EXISTS passports_arrival_idx ON staff.passports(arrival_date);

CREATE TABLE IF NOT EXISTS staff.audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES staff.users(id),
  site_id UUID REFERENCES staff.sites(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO staff.sites (code, name, city, hostname)
VALUES
 ('ADAMA','Adama Immigration Office','Adama','adamaepass.vercel.app'),
 ('HOSSANA','Hossana Immigration Office','Hossana','hossanaepass.vercel.app'),
 ('HAWASSA','Hawassa Immigration Office','Hawassa','hawassaepass.vercel.app')
ON CONFLICT (code) DO NOTHING;

