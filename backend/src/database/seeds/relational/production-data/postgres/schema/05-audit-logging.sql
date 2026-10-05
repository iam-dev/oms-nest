-- =============================================================================
-- AUDIT LOGGING TABLES SCHEMA (PostgreSQL)
-- =============================================================================
-- Source: 1736700000000-InitialSchema.ts
-- Tables: log, dblog
-- =============================================================================

-- Log - Application audit trail
CREATE TABLE IF NOT EXISTS "log" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "user_type" INTEGER NOT NULL,
  "only_for" INTEGER NOT NULL DEFAULT 0,
  "order_id" INTEGER NOT NULL,
  "text" TEXT NOT NULL,
  "time" INTEGER NOT NULL,
  "order_status_updated_from" INTEGER,
  "order_status_updated_to" INTEGER
);

-- DBlog - Database query logging
CREATE TABLE IF NOT EXISTS "dblog" (
  "id" SERIAL PRIMARY KEY,
  "query" TEXT NOT NULL,
  "user" INTEGER NOT NULL,
  "timestamp" INTEGER NOT NULL,
  "page" TEXT NOT NULL,
  "backtrace" TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_log_order_id" ON "log" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_log_user_id" ON "log" ("user_id");
