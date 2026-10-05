-- =============================================================================
-- SYSTEM ADMIN TABLES SCHEMA (PostgreSQL)
-- =============================================================================
-- Source: 1736700000000-InitialSchema.ts
-- Tables: user_types, statuses, credentials, client_confirmation
-- =============================================================================

-- UserTypes - Legacy role definitions (from production)
CREATE TABLE IF NOT EXISTS "user_types" (
  "id" SERIAL PRIMARY KEY,
  "type_description" VARCHAR(100) NOT NULL
);

-- Role - Backend role table (used by NestJS/TypeORM)
-- IDs aligned with user_types: fitter=1, admin=2, factory=3, customsaddler=4
-- Extended roles: supervisor=5, user=6
CREATE TABLE IF NOT EXISTS "role" (
  "id" INTEGER PRIMARY KEY,
  "name" VARCHAR(100) NOT NULL
);

-- Statuses - Order status definitions
CREATE TABLE IF NOT EXISTS "statuses" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(30) NOT NULL UNIQUE,
  "factory_hidden" SMALLINT NOT NULL,
  "factory_alternative_name" VARCHAR(30) NOT NULL,
  "sequence" INTEGER NOT NULL
);

-- Credentials - User authentication
CREATE TABLE IF NOT EXISTS "credentials" (
  "user_id" SERIAL PRIMARY KEY,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "user_type" INTEGER NOT NULL,
  "user_name" VARCHAR(100) NOT NULL UNIQUE,
  "full_name" VARCHAR(200) NOT NULL,
  "password_hash" VARCHAR(60) NOT NULL,
  "last_login" INTEGER NOT NULL,
  "blocked" INTEGER NOT NULL DEFAULT 0,
  "password_reset_hash" VARCHAR(40) NOT NULL,
  "password_reset_valid_to" INTEGER NOT NULL DEFAULT 0,
  "supervisor" SMALLINT NOT NULL DEFAULT 0
);

-- ClientConfirmation
CREATE TABLE IF NOT EXISTS "client_confirmation" (
  "id" SERIAL PRIMARY KEY,
  "uid" VARCHAR(255) NOT NULL UNIQUE,
  "customer_id" INTEGER NOT NULL,
  "order_id" INTEGER NOT NULL,
  "confirmed" SMALLINT NOT NULL DEFAULT 0,
  "send_time" INTEGER NOT NULL DEFAULT 0,
  "confirm_time" INTEGER NOT NULL DEFAULT 0,
  "sign" VARCHAR(255) NOT NULL DEFAULT ''
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_credentials_user_type" ON "credentials" ("user_type");
