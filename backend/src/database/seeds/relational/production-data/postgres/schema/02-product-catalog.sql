-- =============================================================================
-- PRODUCT CATALOG TABLES SCHEMA (PostgreSQL)
-- =============================================================================
-- Source: 1736700000000-InitialSchema.ts
-- Tables: brands, leather_types, options, options_items, presets, presets_items, saddles
-- =============================================================================

-- Brands
CREATE TABLE IF NOT EXISTS "brands" (
  "id" SERIAL PRIMARY KEY,
  "brand_name" VARCHAR(200) NOT NULL
);

-- LeatherTypes
CREATE TABLE IF NOT EXISTS "leather_types" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(250) NOT NULL,
  "sequence" SMALLINT NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0
);

-- Options - Product configuration categories (7-tier pricing)
CREATE TABLE IF NOT EXISTS "options" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(250) NOT NULL,
  "group" VARCHAR(255),
  "price1" INTEGER NOT NULL,
  "price2" INTEGER NOT NULL,
  "price3" INTEGER NOT NULL,
  "price_contrast1" INTEGER NOT NULL,
  "price_contrast2" INTEGER NOT NULL,
  "price_contrast3" INTEGER NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" SMALLINT NOT NULL,
  "extra_allowed" INTEGER NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "price4" INTEGER NOT NULL,
  "price5" INTEGER NOT NULL,
  "price6" INTEGER NOT NULL,
  "price7" INTEGER NOT NULL,
  "price_contrast4" SMALLINT NOT NULL,
  "price_contrast5" INTEGER NOT NULL,
  "price_contrast6" INTEGER NOT NULL,
  "price_contrast7" INTEGER NOT NULL
);

-- OptionsItems - Specific choices within option categories
CREATE TABLE IF NOT EXISTS "options_items" (
  "id" SERIAL PRIMARY KEY,
  "option_id" INTEGER NOT NULL,
  "leather_id" INTEGER NOT NULL DEFAULT 0,
  "name" VARCHAR(250) NOT NULL,
  "user_color" SMALLINT NOT NULL DEFAULT 0,
  "user_leather" SMALLINT NOT NULL DEFAULT 0,
  "price1" SMALLINT NOT NULL DEFAULT 0,
  "price2" SMALLINT NOT NULL DEFAULT 0,
  "price3" SMALLINT NOT NULL DEFAULT 0,
  "sequence" SMALLINT NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "restrict" TEXT,
  "price4" INTEGER NOT NULL DEFAULT 0,
  "price5" INTEGER NOT NULL,
  "price6" INTEGER NOT NULL,
  "price7" INTEGER NOT NULL
);

-- Presets - Saved configurations
CREATE TABLE IF NOT EXISTS "presets" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(250) NOT NULL,
  "sequence" INTEGER NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0
);

-- PresetsItems - Links between presets and option items
CREATE TABLE IF NOT EXISTS "presets_items" (
  "options_id" INTEGER NOT NULL,
  "item_id" INTEGER NOT NULL,
  "preset_id" INTEGER NOT NULL,
  UNIQUE ("options_id", "item_id", "preset_id")
);

-- Saddles - Master product entity
CREATE TABLE IF NOT EXISTS "saddles" (
  "id" SERIAL PRIMARY KEY,
  "factory_eu" INTEGER NOT NULL,
  "factory_gb" INTEGER NOT NULL,
  "factory_us" INTEGER NOT NULL,
  "brand" VARCHAR(300) NOT NULL,
  "model_name" VARCHAR(255) NOT NULL,
  "presets" TEXT NOT NULL,
  "active" SMALLINT NOT NULL DEFAULT 1,
  "type" SMALLINT NOT NULL DEFAULT 0,
  "deleted" INTEGER NOT NULL DEFAULT 0,
  "sequence" INTEGER NOT NULL,
  "factory_ca" INTEGER NOT NULL,
  "factory_aud" INTEGER,
  "factory_de" INTEGER,
  "factory_nl" INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_options_items_option_id" ON "options_items" ("option_id");
