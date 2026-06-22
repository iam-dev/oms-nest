# Production Cutover Runbook

End-to-end procedure for replacing the production OMS PostgreSQL database in place with a fresh import from a MySQL/MariaDB production dump.

This runbook is the **same procedure rehearsed against staging on 2026-06-18/19**. The full rehearsal log with surprises and lessons is in [`prod-migration-rehearsal-log.md`](prod-migration-rehearsal-log.md).

> **Target downtime: ~45 minutes** (29 min budgeted execution + 16 min slack for verification and rollback decision).

## When to use this

When you have a fresh production MySQL dump and need to refresh the prod NestJS Postgres database with its data. The database name is preserved; the K8s connection strings/secrets do not need to change.

## Pre-flight checklist (do these BEFORE the cutover window)

Estimated time: 30 minutes the day before, 5 minutes the morning of.

### 1. Verify required tools and access

```bash
docker info                    # daemon up
docker image inspect postgres:18 mysql:8.0  # both pulled
doctl account get              # token valid; if not, rotate via DO web console + .env.production
kubectl get ns oms-production  # cluster reachable (verify actual namespace name!)
kubectl get deploy -n oms-production    # confirm deploy names
```

If `doctl account get` fails, generate a new token at DigitalOcean → API → Personal Access Tokens (scope: read+write), update `backend/.env.production` line containing `DIGITALOCEAN_ACCESS_TOKEN=...`, re-run `doctl auth init -t <new token>`.

### 2. Capture the production PG cluster ID

```bash
doctl databases list --format ID,Name,Region | grep prod
# Capture the UUID for the prod cluster — needed in step C1
```

### 3. Pre-stage the new dump

```bash
# Unzip wherever the new dump lives (typically delivered by ops as a .zip):
unzip /path/to/ordermysaddle-prod.sql.zip -d /tmp/oms_prod_dump/
# Verify it's a MariaDB/MySQL dump:
head -5 /tmp/oms_prod_dump/*.sql   # Should say "-- MySQL dump 10.15  Distrib 10.0.38-MariaDB" or similar
```

### 4. Backup everything

```bash
# 4a. Backup current production-data folder (sources of truth for the SQL transforms):
mkdir -p ~/db-backups
tar czf ~/db-backups/production-data-prod-$(date -u +%Y%m%dT%H%M%SZ).tar.gz \
  -C backend/src/database/seeds/relational production-data

# 4b. Backup current PROD database (your ONLY recovery path):
mkdir -p ~/db-backups/oms-prod
TS=$(date -u +%Y%m%dT%H%M%SZ)
docker run --rm \
  -e PGPASSWORD='<PROD_DB_PASSWORD>' \
  -v ~/db-backups/oms-prod:/backup \
  postgres:18 \
  pg_dump \
    --host=<PROD_HOST> --port=<PROD_PORT> \
    --username=<PROD_USER> --dbname=<PROD_DB> \
    --format=custom --compress=6 --no-owner --no-privileges \
    --file=/backup/oms-prod-${TS}.dump
ls -lh ~/db-backups/oms-prod/oms-prod-${TS}.dump
```

### 5. Regenerate per-table SQL files from the new dump

This is Phase B of the rehearsal — must be done BEFORE the cutover window because it takes ~3 minutes and is non-destructive on prod.

```bash
# 5a. Start the local MySQL legacy container and import the new dump:
cd backend/src/database/seeds/relational/production-data/mysql-legacy/scripts
./setup-mysql.sh
docker exec -i oms_mysql_legacy mysql --max_allowed_packet=512M \
  -u oms_user -poms_password oms_legacy < /tmp/oms_prod_dump/*.sql

# 5b. Re-apply the documented FactoryEmployees fix
# (Every fresh dump regresses this. See README "Fixed Issues" §1.)
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "
UPDATE FactoryEmployees SET FactoryID = 3 WHERE ID = 1;
UPDATE FactoryEmployees SET FactoryID = 4 WHERE ID = 2;"

# 5c. Regenerate per-table .sql files in mysql-legacy/data/ (extended INSERT format):
# Use the mapping in prod-migration-rehearsal-log.md "B2" section.
# Important: pass --complete-insert (so column names are in the INSERT) and --no-tablespaces for schema dumps.

# 5d. Regenerate postgres/ via the transform script:
cd ../../postgres/scripts
./transform-mysql-to-postgres.sh

# 5e. CRITICAL — apply boolean transform to postgres/data/core-business/orders.sql
# transform-orders-booleans.py is documented but only handles the extended-INSERT format.
# Run the per-row boolean transform from the rehearsal log instead.
# Result: positions 5/45/47/48/49/50 of every INSERT change from 0/1 to false/true.

# 5f. Pre-generate TSV files for the large tables (avoid INSERT-loop latency at cutover time):
python3 - <<'PY'
# Convert orders_info.sql → /tmp/orders_info.tsv (1.15M rows in ~7s, gives 19MB file)
# See rehearsal log "C3 surprise #2" for the conversion script.
PY
```

After step 5, you have:
- `postgres/data/*.sql` files validated locally (verify via `import-data.sh` against a local Docker PG18 if you want extra safety)
- `/tmp/orders_info.tsv` ready for COPY

## Cutover (the actual ~29 minute window)

> **All commands assume:** `backend/.env.production` is set up with valid `DATABASE_*` vars (including `DATABASE_CA`) and `DIGITALOCEAN_ACCESS_TOKEN`.

### C0 — Scale prod app deploys to 0 (drain connections)

```bash
kubectl scale deploy -n oms-production oms-backend oms-frontend --replicas=0
kubectl wait --for=delete pods -n oms-production -l app=oms-backend --timeout=120s
kubectl wait --for=delete pods -n oms-production -l app=oms-frontend --timeout=120s
```

Expected: ~12 seconds. Verify with `kubectl get pods -n oms-production`.

> ⚠️ **App is now down.** Users will see "service unavailable" until C7.

### C1 — Drop and recreate the prod database (preserving the name)

```bash
CLUSTER_ID=<from pre-flight step 2>
DB_NAME=<actual prod DB name>

doctl databases db delete "$CLUSTER_ID" "$DB_NAME" --force
sleep 5
doctl databases db create "$CLUSTER_ID" "$DB_NAME"
```

Expected: ~10 seconds.

### C1a — Wait for new DB ready

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if PGPASSWORD=<prod password> psql "host=<prod host> port=<prod port> dbname=$DB_NAME user=doadmin sslmode=require" -c '\dt' >/dev/null 2>&1; then
    echo "READY"; break
  fi
  sleep 2
done
```

### C2 — Apply all TypeORM migrations from scratch

```bash
cd backend
npm run migration:production:run   # if wired; otherwise:
# env-cmd -f .env.production typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run
```

Expected: ~22 seconds for 28 migrations. The data-dependent migrations (`SeedJobSheetsForAdamWhitehouse1773100000000` etc.) will return early because `credentials` is empty at this point — this is expected and matches the rehearsal.

### C3 — Load data via psql in FK dependency order

```bash
export PGPASSWORD='<prod password>'
CONN="host=<prod host> port=<prod port> dbname=$DB_NAME user=doadmin sslmode=require"
PG_DATA=backend/src/database/seeds/relational/production-data/postgres/data

# Strict FK dependency order:
FILES=(
  "system-admin/user-types.sql"
  "system-admin/roles.sql"
  "system-admin/statuses.sql"
  "system-admin/credentials.sql"
  "system-admin/client-confirmation.sql"
  "product-catalog/brands.sql"
  "product-catalog/leather-types.sql"
  "product-catalog/options.sql"
  "product-catalog/options-items.sql"
  "product-catalog/presets.sql"
  "product-catalog/presets-items.sql"
  "product-catalog/saddles.sql"
  "core-business/factories.sql"
  "core-business/factory-employees.sql"
  "core-business/fitters.sql"
  "core-business/customers.sql"
  "core-business/orders.sql"   # MUST have booleans applied per step 5e
  "relationships/saddle-leathers.sql"
  "relationships/saddle-options-items.sql"
)
# orders-info handled separately via COPY (see below)

for f in "${FILES[@]}"; do
  STEP_START=$(date +%s)
  psql "$CONN" -v ON_ERROR_STOP=0 -f "$PG_DATA/$f"
  # CRITICAL: verify row count after each file — exit code alone is not trustworthy
  TABLE=$(basename "$f" .sql | tr - _)
  ACTUAL=$(psql "$CONN" -t -A -c "SELECT COUNT(*) FROM $TABLE;")
  echo "  $f → $TABLE: $ACTUAL rows ($(($(date +%s) - STEP_START))s)"
done
```

Compare each ACTUAL to the expected counts in `production-data/README.md`. If `orders` shows 0, **the boolean transform from step 5e was not applied** — stop and re-apply before continuing.

**MANDATORY: cross-check row count against source MySQL after orders.sql.** Diff order IDs between source and staging to catch silent per-row failures from values like `'CUSTOMER BUCK\'` (literal trailing backslash) that confuse parsers:

```bash
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "SELECT ID FROM Orders ORDER BY ID;" -BN > /tmp/mysql_order_ids.txt
psql "$CONN" -tAc "SELECT id FROM orders ORDER BY id;" > /tmp/pg_order_ids.txt
MISSING=$(comm -23 <(sort -n /tmp/mysql_order_ids.txt) <(sort -n /tmp/pg_order_ids.txt))
if [ -n "$MISSING" ]; then
  echo "MISSING IDS: $MISSING"
  # Re-dump those rows with --complete-insert and use the name-based boolean fixup,
  # then re-INSERT. See prod-migration-rehearsal-log.md Surprise #16 for the script.
fi
```

### C3-COPY — Bulk-load orders_info via COPY (8 seconds for 1.15M rows)

```bash
psql "$CONN" -c "\COPY orders_info (order_id, option_id, option_item_id, clone_number, color, leathertype, custom) FROM '/tmp/orders_info.tsv' WITH (FORMAT text);"
psql "$CONN" -c "SELECT COUNT(*) FROM orders_info;"
```

Expected: ~8 seconds. Result should match the row count in the source dump.

### C3-SEQ — Reset all SERIAL sequences to MAX(id) (CRITICAL)

> **Discovered in rehearsal Surprise #17.** psql/COPY imports preserve explicit IDs but do NOT advance the underlying sequences. Without this step, the app's first auto-INSERT collides with row id=1.

```bash
psql "$CONN" <<'SQL'
DO $$
DECLARE rec RECORD; max_id BIGINT; cmd TEXT;
BEGIN
  FOR rec IN
    SELECT n.nspname AS schema_name, c.relname AS seq_name,
           dep_tbl.relname AS table_name, a.attname AS column_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_depend d ON d.objid = c.oid AND d.deptype = 'a'
    JOIN pg_class dep_tbl ON dep_tbl.oid = d.refobjid
    JOIN pg_attribute a ON a.attrelid = dep_tbl.oid AND a.attnum = d.refobjsubid
    WHERE c.relkind = 'S' AND n.nspname = 'public'
  LOOP
    cmd := format('SELECT COALESCE(MAX(%I), 0) FROM %I.%I',
                  rec.column_name, rec.schema_name, rec.table_name);
    EXECUTE cmd INTO max_id;
    IF max_id > 0 THEN
      EXECUTE format('SELECT setval(%L, %s, true)',
                     rec.schema_name || '.' || rec.seq_name, max_id);
      RAISE NOTICE 'Set % to %', rec.seq_name, max_id;
    END IF;
  END LOOP;
END$$;
SQL
```

Verify a critical sequence: `psql "$CONN" -c "SELECT last_value FROM pg_sequences WHERE sequencename='orders_id_seq';"` → should equal `MAX(id) FROM orders`.

### C3b — Refresh materialized views

```bash
psql "$CONN" -c "REFRESH MATERIALIZED VIEW enriched_order_view; REFRESH MATERIALIZED VIEW order_edit_view;"
psql "$CONN" -c "SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('enriched_order_view','order_edit_view');"
```

Expected: ~4 seconds. Both views should now have rows matching the `orders` count.

### C4 — Extract seat sizes

```bash
cd backend/src/database/seeds/relational/production-data/postgres/scripts
PGSSLMODE=require \
PG_HOST=<prod host> \
PG_PORT=<prod port> \
PG_USER=doadmin \
PG_PASSWORD='<prod password>' \
PG_DATABASE=$DB_NAME \
bash ./extract-seat-sizes.sh --env production --apply
```

Expected: ~20 seconds. Should report ~99% of orders updated.

### C5 — Schema diff (sanity check)

```bash
# Dump the pre-cutover backup's schema and the new prod schema; diff them.
docker run --rm -v ~/db-backups/oms-prod:/backup postgres:18 \
  pg_restore --schema-only --no-owner --no-privileges /backup/oms-prod-${TS}.dump > /tmp/prod_old_schema.sql
docker run --rm -e PGPASSWORD="$PGPASSWORD" postgres:18 \
  pg_dump "$CONN" --schema-only --no-owner --no-privileges --no-comments > /tmp/prod_new_schema.sql

diff <(grep -v "^\\\\restrict\|^-- Dumped from" /tmp/prod_old_schema.sql) \
     <(grep -v "^\\\\restrict\|^-- Dumped from" /tmp/prod_new_schema.sql)
# Expected: empty (zero semantic diff)
```

### C5b — Row count diff

Compare current prod counts against the local pre-cutover backup restored into a local PG18 container (the same way A1+A2 worked in the rehearsal). Diff should match the rehearsal pattern:
- Legacy tables ↑ (newer dump bigger)
- NestJS-only tables (`audit_log`, `log`, `dblog`, `custom_order_views`, etc.) → 0 in new (runtime data lost, expected)
- Schema-defined empty tables → still 0

### C7 — Scale prod app deploys back up

```bash
kubectl scale deploy -n oms-production oms-backend oms-frontend --replicas=1
kubectl wait --for=condition=available deploy/oms-backend deploy/oms-frontend -n oms-production --timeout=120s
kubectl get pods -n oms-production
```

### Verify the app is healthy

```bash
# Via port-forward (bypasses any ingress/Apache redirect confusion):
kubectl port-forward -n oms-production deploy/oms-backend 3001:3001 &
PF=$!
sleep 3
curl -s http://localhost:3001/api/health | jq
kill $PF
```

Expected:
```json
{
  "status": "ok",
  "info": {
    "nestjs-database": {"status": "up"},
    "redis": {"status": "up"},
    "memory_heap": {"status": "up"},
    "storage": {"status": "up"}
  }
}
```

If `nestjs-database` is **down**, check pod logs:
```bash
kubectl logs -n oms-production -l app=oms-backend --tail=50
```

## Rollback procedure

If anything in C2–C5b looks wrong and you decide to abort:

```bash
# 1. Scale down again
kubectl scale deploy -n oms-production oms-backend oms-frontend --replicas=0

# 2. Drop and recreate the DB once more
doctl databases db delete "$CLUSTER_ID" "$DB_NAME" --force
sleep 5
doctl databases db create "$CLUSTER_ID" "$DB_NAME"

# 3. pg_restore the backup taken in pre-flight step 4b
docker run --rm \
  -e PGPASSWORD="$PGPASSWORD" \
  -v ~/db-backups/oms-prod:/backup \
  postgres:18 \
  pg_restore \
    --host=<prod host> --port=<prod port> \
    --username=doadmin --dbname=$DB_NAME \
    --no-owner --no-privileges \
    /backup/oms-prod-${TS}.dump

# 4. Scale back up
kubectl scale deploy -n oms-production oms-backend oms-frontend --replicas=1
```

The pg_restore for 50k orders + 1.1M orders_info typically takes ~15 minutes. Plan total rollback at **~25 minutes**.

## Post-cutover checks (next morning)

| Check | What to look for |
|---|---|
| App error rate (Sentry / logs) | No spike — usual baseline |
| Order CRUD smoke test | Create + read + update + soft-delete one test order |
| Materialized views fresh | `SELECT max(order_time) FROM enriched_order_view;` matches `orders` |
| Seat sizes populated | `SELECT COUNT(*) FROM orders WHERE seat_sizes IS NOT NULL;` ~99% |
| audit_log starts accumulating | New rows since cutover timestamp |

## Known caveats (carried over from staging rehearsal)

These are not blockers but worth knowing:

1. **Old runtime data is gone on the new DB:** `audit_log`, `log`, `dblog`, `custom_order_views` (Adam Whitehouse seeds skipped because credentials empty at migration time), `custom_order_view_groups`, runtime brand additions. None of this affects correctness of orders/customers/etc.
2. **`brands` count differs from old prod by however many were manually added at runtime.** New dump's count is authoritative.
3. **Materialized views needed REFRESH after import** (would be empty otherwise). C3b handles this.
4. **`doadmin` cannot disable triggers** (`SET session_replication_role = replica` fails). Workaround is to load in FK order, which is what C3 does.

## Owner

Update this section with the actual on-call for the cutover. Include:
- Primary executor
- Secondary (verify, type commands)
- Communication channel for the window (Slack channel, etc.)
- Customer comms plan (status page, banner, email)

---

*Generated from the staging rehearsal on 2026-06-18/19. See [`prod-migration-rehearsal-log.md`](prod-migration-rehearsal-log.md) for the full rehearsal log, surprises, and lessons learned.*
