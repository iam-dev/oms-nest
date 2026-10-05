-- =============================================================================
-- CORE BUSINESS TABLES SCHEMA (PostgreSQL)
-- =============================================================================
-- Source: 1736700000000-InitialSchema.ts
-- Tables: factories, factory_employees, fitters, customers, orders
-- =============================================================================

-- Factories
CREATE TABLE IF NOT EXISTS "factories" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "address" VARCHAR(200) NOT NULL,
  "zipcode" VARCHAR(20) NOT NULL,
  "state" VARCHAR(200) NOT NULL,
  "city" VARCHAR(200) NOT NULL,
  "country" VARCHAR(255) NOT NULL,
  "phone_no" VARCHAR(11) NOT NULL,
  "cell_no" VARCHAR(11) NOT NULL,
  "currency" INTEGER NOT NULL DEFAULT 1,
  "emailaddress" VARCHAR(200) NOT NULL
);

-- FactoryEmployees
CREATE TABLE IF NOT EXISTS "factory_employees" (
  "id" SERIAL PRIMARY KEY,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "name" VARCHAR(255) NOT NULL,
  "factory_id" INTEGER NOT NULL
);

-- Fitters
CREATE TABLE IF NOT EXISTS "fitters" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "address" VARCHAR(200) NOT NULL,
  "zipcode" VARCHAR(20) NOT NULL,
  "state" VARCHAR(200) NOT NULL,
  "city" VARCHAR(200) NOT NULL,
  "country" VARCHAR(100) NOT NULL,
  "phone_no" VARCHAR(20) NOT NULL,
  "cell_no" VARCHAR(20) NOT NULL,
  "currency" INTEGER NOT NULL DEFAULT 1,
  "emailaddress" VARCHAR(200) NOT NULL
);

-- Customers
CREATE TABLE IF NOT EXISTS "customers" (
  "id" SERIAL PRIMARY KEY,
  "deleted" SMALLINT NOT NULL DEFAULT 0,
  "fitter_id" INTEGER NOT NULL DEFAULT 0,
  "horse_name" VARCHAR(255) NOT NULL DEFAULT '',
  "name" VARCHAR(255) NOT NULL DEFAULT '',
  "address" VARCHAR(255) NOT NULL DEFAULT '',
  "company" VARCHAR(255) NOT NULL DEFAULT '',
  "city" VARCHAR(255) NOT NULL DEFAULT '',
  "country" VARCHAR(255) NOT NULL DEFAULT '',
  "state" VARCHAR(255) NOT NULL DEFAULT '',
  "zipcode" VARCHAR(20) NOT NULL DEFAULT '',
  "email" VARCHAR(300) NOT NULL DEFAULT '',
  "phone_no" VARCHAR(20) NOT NULL DEFAULT '',
  "cell_no" VARCHAR(20) NOT NULL DEFAULT '',
  "bank_account_number" VARCHAR(20) NOT NULL DEFAULT ''
);

-- Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "id" SERIAL PRIMARY KEY,
  "fitter_id" INTEGER NOT NULL,
  "saddle_id" INTEGER NOT NULL,
  "leather_id" INTEGER NOT NULL DEFAULT 0,
  "factory_id" INTEGER NOT NULL,
  "fitter_stock" BOOLEAN NOT NULL DEFAULT false,
  "customer_id" INTEGER NOT NULL DEFAULT 0,
  "shipped_by_employee" INTEGER NOT NULL DEFAULT 0,
  "fitter_reference" VARCHAR(255) NOT NULL DEFAULT '',
  "last_seen_fitter" INTEGER NOT NULL DEFAULT 0,
  "last_seen_cs" INTEGER NOT NULL DEFAULT 0,
  "last_seen_factory" INTEGER NOT NULL DEFAULT 0,
  "horse_name" VARCHAR(255) NOT NULL DEFAULT '',
  "name" VARCHAR(255) NOT NULL DEFAULT '',
  "address" VARCHAR(255) NOT NULL DEFAULT '',
  "zipcode" VARCHAR(20) NOT NULL DEFAULT '',
  "city" VARCHAR(255) NOT NULL DEFAULT '',
  "state" VARCHAR(255) NOT NULL DEFAULT '',
  "country" VARCHAR(255) NOT NULL DEFAULT '',
  "phone_no" VARCHAR(20) NOT NULL DEFAULT '',
  "cell_no" VARCHAR(20) NOT NULL DEFAULT '',
  "email" VARCHAR(300) NOT NULL DEFAULT '',
  "order_status" INTEGER NOT NULL DEFAULT 0,
  "ship_name" VARCHAR(255) NOT NULL DEFAULT '',
  "ship_address" VARCHAR(255) NOT NULL DEFAULT '',
  "ship_zipcode" VARCHAR(20) NOT NULL DEFAULT '',
  "ship_city" VARCHAR(255) NOT NULL DEFAULT '',
  "ship_state" VARCHAR(255) NOT NULL DEFAULT '',
  "ship_country" VARCHAR(255) NOT NULL DEFAULT '',
  "order_time" INTEGER NOT NULL,
  "payment" TEXT NOT NULL,
  "payment_time" INTEGER NOT NULL DEFAULT 0,
  "order_step" INTEGER NOT NULL DEFAULT 1,
  "price_saddle" INTEGER NOT NULL,
  "price_tradein" INTEGER NOT NULL,
  "price_deposit" INTEGER NOT NULL,
  "price_discount" INTEGER NOT NULL,
  "price_fittingeval" INTEGER NOT NULL,
  "price_callfee" INTEGER NOT NULL,
  "price_girth" INTEGER NOT NULL,
  "price_shipping" INTEGER NOT NULL,
  "price_tax" INTEGER NOT NULL,
  "price_additional" INTEGER NOT NULL DEFAULT 0,
  "special_notes" TEXT NOT NULL,
  "serial_number" VARCHAR(100) NOT NULL DEFAULT '',
  "custom_order" BOOLEAN NOT NULL DEFAULT false,
  "changed" INTEGER NOT NULL DEFAULT 0,
  "repair" BOOLEAN NOT NULL DEFAULT false,
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "sponsored" BOOLEAN NOT NULL DEFAULT false,
  "rushed" BOOLEAN NOT NULL DEFAULT false,
  "oms_version" INTEGER NOT NULL DEFAULT 1,
  "currency" INTEGER NOT NULL DEFAULT 0,
  "order_data" TEXT NOT NULL,
  "seat_sizes" JSONB DEFAULT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "idx_orders_customer_id" ON "orders" ("customer_id");
CREATE INDEX IF NOT EXISTS "idx_orders_fitter_id" ON "orders" ("fitter_id");
CREATE INDEX IF NOT EXISTS "idx_orders_factory_id" ON "orders" ("factory_id");
CREATE INDEX IF NOT EXISTS "idx_orders_saddle_id" ON "orders" ("saddle_id");
CREATE INDEX IF NOT EXISTS "idx_orders_order_status" ON "orders" ("order_status");
CREATE INDEX IF NOT EXISTS "idx_customers_fitter_id" ON "customers" ("fitter_id");
CREATE INDEX IF NOT EXISTS "idx_fitters_user_id" ON "fitters" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_factory_employees_factory_id" ON "factory_employees" ("factory_id");
