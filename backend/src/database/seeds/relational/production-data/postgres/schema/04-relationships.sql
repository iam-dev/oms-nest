-- =============================================================================
-- RELATIONSHIP TABLES SCHEMA (PostgreSQL)
-- =============================================================================
-- Source: 1736700000000-InitialSchema.ts
-- Tables: saddle_leathers, saddle_options_items, orders_info
-- =============================================================================

-- SaddleLeathers - Links saddles with leather options (7-tier pricing)
CREATE TABLE IF NOT EXISTS "saddle_leathers" (
  "id" SERIAL PRIMARY KEY,
  "saddle_id" INTEGER NOT NULL,
  "leather_id" INTEGER NOT NULL,
  "price1" INTEGER NOT NULL,
  "price2" INTEGER NOT NULL,
  "price3" INTEGER NOT NULL,
  "sequence" SMALLINT NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "price4" INTEGER NOT NULL,
  "price5" INTEGER NOT NULL,
  "price6" INTEGER NOT NULL,
  "price7" INTEGER NOT NULL
);

-- SaddleOptionsItems - Complex saddle configuration
CREATE TABLE IF NOT EXISTS "saddle_options_items" (
  "id" SERIAL PRIMARY KEY,
  "saddle_id" INTEGER NOT NULL,
  "option_id" INTEGER NOT NULL,
  "option_item_id" INTEGER NOT NULL,
  "leather_id" INTEGER NOT NULL,
  "sequence" SMALLINT NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0
);

-- OrdersInfo - Order configuration details (composite primary key)
CREATE TABLE IF NOT EXISTS "orders_info" (
  "order_id" INTEGER NOT NULL,
  "option_id" INTEGER NOT NULL DEFAULT 0,
  "option_item_id" INTEGER NOT NULL DEFAULT 0,
  "clone_number" INTEGER NOT NULL,
  "color" VARCHAR(200) NOT NULL,
  "leathertype" VARCHAR(200) NOT NULL,
  "custom" VARCHAR(200) NOT NULL,
  PRIMARY KEY ("order_id", "option_id", "option_item_id", "clone_number")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_saddle_leathers_saddle_id" ON "saddle_leathers" ("saddle_id");
CREATE INDEX IF NOT EXISTS "idx_saddle_leathers_leather_id" ON "saddle_leathers" ("leather_id");
CREATE INDEX IF NOT EXISTS "idx_saddle_options_items_saddle_id" ON "saddle_options_items" ("saddle_id");
