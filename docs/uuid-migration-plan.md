# UUID Migration Plan

## Overview

Migrate all entity primary keys from auto-increment integers to UUIDs (`uuid_generate_v4()`). This eliminates enumerable IDs (security), simplifies cross-environment data merging, and aligns with the UUID pattern already used by `extras` and `files`.

## Current State Inventory

### UUID Entities (already done — 2)
| Entity | Table |
|--------|-------|
| Extra | `extras` |
| File | `files` |

### Integer ID Entities (to migrate — 21)
| Entity | Table | FK Dependencies |
|--------|-------|-----------------|
| User | `user` | Session, Order, Comment, AuditLog, AccessFilterGroup |
| Session | `session` | User (FK) |
| Order | `order` | Customer, Fitter, Factory, OrderLine, OrderProductSaddle, Comment |
| Customer | `customer` | Order, Fitter (nullable) |
| Fitter | `fitter` | Order, Customer, SaddleStock |
| Factory | `factory` | Order, FactoryEmployee |
| Brand | `brand` | Saddle, Option |
| Saddle | `saddle` | Brand, SaddleLeather, SaddleExtra, SaddleOptionsItem, OrderProductSaddle |
| Leathertype | `leathertype` | SaddleLeather |
| Option | `option` | OptionItem, SaddleOptionsItem, Brand |
| OptionItem | `option_item` | Option, SaddleOptionsItem |
| Preset | `preset` | PresetItem |
| OrderLine | `order_line` | Order |
| OrderProductSaddle | `order_product_saddle` | Order, Saddle |
| Comment | `comment` | Order, User |
| FactoryEmployee | `factory_employee` | Factory |
| CountryManager | `country_manager` | — |
| AccessFilterGroup | `access_filter_group` | User |
| SaddleLeather | `saddle_leather` | Saddle, Leathertype |
| SaddleExtra | `saddle_extra` | Saddle, Extra |
| SaddleOptionsItem | `saddle_options_item` | Saddle, OptionItem |
| AuditLog | `audit_log` | User |
| DatabaseQueryLog | `database_query_log` | — |

### Non-Generated IDs (do NOT migrate)
| Entity | Table | Reason |
|--------|-------|--------|
| Role | `role` | Lookup table, fixed enum IDs (1-6) |
| Status | `status` | Lookup table, fixed enum IDs |
| PresetItem | `preset_item` | Composite PK |
| Warehouse | `warehouse` | Already UUID (externally assigned) |

### Special: User Dual-ID
The `User` entity has `id` (integer PK) and `legacyId` (nullable integer for legacy system mapping). After migration, `id` becomes UUID, `legacyId` remains integer for legacy system reference.

---

## Migration Strategy: 4 Phases

### Phase 1: Add UUID Columns (non-breaking)

**Goal**: Add a `uuid` column to every integer-PK table, populate it, and index it.

```sql
-- For each table:
ALTER TABLE "order" ADD COLUMN "uuid" UUID DEFAULT uuid_generate_v4();
UPDATE "order" SET "uuid" = uuid_generate_v4() WHERE "uuid" IS NULL;
ALTER TABLE "order" ALTER COLUMN "uuid" SET NOT NULL;
CREATE UNIQUE INDEX "IDX_order_uuid" ON "order" ("uuid");
```

**TypeORM changes**: Add `@Column({ type: 'uuid', unique: true, default: () => 'uuid_generate_v4()' }) uuid: string;` to every entity alongside the existing integer `id`.

**API changes**: None. Existing integer IDs continue to work.

**Rollback**: `ALTER TABLE "order" DROP COLUMN "uuid";`

**Migration order** (leaves first, works inward):
1. Leaf tables (no FK dependents): CountryManager, DatabaseQueryLog, AuditLog, Comment, OrderLine, FactoryEmployee, AccessFilterGroup, SaddleLeather, SaddleExtra, SaddleOptionsItem, OrderProductSaddle, Session
2. Mid-level tables: OptionItem, Leathertype, Preset
3. Core tables: Option, Brand, Saddle, Customer, Fitter, Factory
4. Top-level tables: Order, User

### Phase 2: Dual-ID API (backward compatible)

**Goal**: API accepts and returns both `id` (integer) and `uuid`. Frontend starts using UUID for all new operations.

**TypeORM changes**: Update repositories to support lookup by both `id` and `uuid`. Services accept either format.

**API changes**:
- All GET responses include both `id` and `uuid`
- All endpoints accept both `id` (integer) and `uuid` for path parameters
- New records default to UUID references

**Frontend changes**: Update services to prefer `uuid` over `id` in URLs and state.

**Rollback**: Revert API to integer-only lookups.

### Phase 3: Switch Foreign Keys to UUID

**Goal**: Replace integer FK columns with UUID FK columns.

For each FK relationship:
```sql
-- Add UUID FK column
ALTER TABLE "order" ADD COLUMN "customer_uuid" UUID;

-- Populate from join
UPDATE "order" o SET "customer_uuid" = c."uuid"
FROM "customer" c WHERE o."customer_id" = c."id";

-- Add constraint
ALTER TABLE "order" ADD CONSTRAINT "FK_order_customer_uuid"
  FOREIGN KEY ("customer_uuid") REFERENCES "customer"("uuid");

-- Drop old FK
ALTER TABLE "order" DROP CONSTRAINT "FK_order_customer_id";
ALTER TABLE "order" DROP COLUMN "customer_id";
ALTER TABLE "order" RENAME COLUMN "customer_uuid" TO "customer_id";
```

**Migration order** (reverse of Phase 1 — core tables first):
1. User, Order (update FKs that reference them)
2. Customer, Fitter, Factory, Saddle, Brand, Option
3. OptionItem, Leathertype, Preset
4. All leaf tables

**Rollback**: Reverse the column rename, re-add integer FK columns, repopulate from UUID join.

### Phase 4: Switch Primary Keys to UUID

**Goal**: Remove integer PK, promote UUID to PK.

```sql
-- Drop old integer PK
ALTER TABLE "order" DROP CONSTRAINT "order_pkey";

-- Promote UUID to PK
ALTER TABLE "order" RENAME COLUMN "uuid" TO "id";
ALTER TABLE "order" ADD PRIMARY KEY ("id");

-- Drop old integer column
ALTER TABLE "order" DROP COLUMN "old_id";
```

**TypeORM changes**: Change `@PrimaryGeneratedColumn()` to `@PrimaryGeneratedColumn('uuid')`.

**Rollback**: Add back integer column, restore as PK.

### Materialized Views

The `enriched_order_view` and `order_edit_view` must be updated after Phase 3/4:
1. Drop existing views
2. Re-create with UUID joins
3. Refresh materialized views

---

## FK Dependency Graph

```
User ──────┬── Session
           ├── Comment ──── Order
           ├── AuditLog
           └── AccessFilterGroup

Order ─────┬── OrderLine
           ├── OrderProductSaddle ── Saddle
           ├── Comment
           ├── Customer
           ├── Fitter
           └── Factory ── FactoryEmployee

Saddle ────┬── SaddleLeather ── Leathertype
           ├── SaddleExtra ── Extra (already UUID)
           ├── SaddleOptionsItem ── OptionItem ── Option
           └── Brand

Preset ──── PresetItem (composite PK, skip)
```

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|------------|
| 1 | Low | Additive only, no existing columns affected |
| 2 | Low | Backward compatible, both ID formats work |
| 3 | High | FK changes require careful ordering and data integrity checks |
| 4 | High | PK swap requires downtime or careful blue-green deployment |

---

## Prerequisites

- [ ] PostgreSQL `uuid-ossp` extension enabled (`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`)
- [ ] Full database backup before each phase
- [ ] E2E tests passing with integer IDs (baseline)
- [ ] Frontend services updated to handle both ID formats (Phase 2)
- [ ] Materialized view recreation scripts ready (Phase 3/4)

---

## Timeline Estimate

- **Phase 1**: Can be done immediately, no risk
- **Phase 2**: After Phase 1 is deployed and stable (1-2 weeks)
- **Phase 3**: After Phase 2 is verified in staging (1-2 weeks, requires maintenance window)
- **Phase 4**: After Phase 3 is stable in production (1 week, requires maintenance window)

Total: 4-6 weeks with proper testing between phases.
