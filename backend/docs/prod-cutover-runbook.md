# Production Cutover Runbook

End-to-end procedure for replacing the production OMS PostgreSQL database in place with a fresh import from a MySQL/MariaDB production dump.

The data steps are **not described here any more**. They are the single procedure in [`docs/production-data-migration.md`](../../docs/production-data-migration.md): Part A (export → verified dump, done before the window) and Part B (load a database, done inside the window). This runbook adds what is specific to a live environment: backups, scaling the app down and up, recreating the database, and rollback.

What was rehearsed, and when:

| Part | Rehearsed |
|---|---|
| Scale down/up, drop and recreate the database with `doctl`, schema diff, rollback restore | Against staging on 2026-06-18/19 ([`prod-migration-rehearsal-log.md`](prod-migration-rehearsal-log.md)) |
| Part A and Part B of the data procedure | Twice on 2026-10-05 in new local containers, including a PostgreSQL 16 database owned by a non-superuser |
| Loading a DigitalOcean database from a local dump in one transaction | 2026-09-28 for the new staging cluster (about 10 minutes for the restore) |
| This runbook as a whole, in its current form | **Not yet.** Rehearse it once against staging before the production cutover. |

> **Target downtime: ~45 minutes.** Expected execution is about 20 minutes (restore about 10, verification about 3, the rest under a minute each); the remainder is slack for checks and the rollback decision.

## When to use this

When you have a fresh production MySQL dump and need to refresh the prod NestJS Postgres database with its data. The database name is preserved; the K8s connection strings/secrets do not need to change.

## Pre-flight checklist (do these BEFORE the cutover window)

Estimated time: 30 minutes the day before, 5 minutes the morning of.

### 1. Verify required tools and access

```bash
docker info                    # daemon up
docker image inspect postgres:18 postgres:17.6-alpine mysql:8.0  # all pulled
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
head -c 300 /tmp/oms_prod_dump/*.sql   # CREATE TABLE `Brands` ... near the top
```

The September 2026 export is a plain SQL file: no `-- MySQL dump` header and no `SET NAMES`. That is why the load command in Part A must pass `--default-character-set=utf8mb4`.

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

### 5. Run Part A of the data procedure

Follow [Part A of `docs/production-data-migration.md`](../../docs/production-data-migration.md#part-a--from-the-export-to-a-verified-dump) with the new export. It takes about 15 minutes, touches nothing remote, and ends with:

- `RESULT: PASS - every legacy row and cell matches MySQL.` from `verify-against-mysql.py` for the build database
- `Total: 0 cells` from `npm run data:fix-utf8`
- a dump file `~/db-backups/oms-legacy-data-<UTC time>.sql.gz` and its SHA256

Write the dump file name and the checksum into the cutover notes. Keep the MySQL container `oms_mysql_legacy` running: the verification inside the window compares production with it.

Do not start the window without all three.

## Cutover (the downtime window)

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

If the production user is not `doadmin` and cannot drop the database, empty it instead with `DROP OWNED BY CURRENT_USER CASCADE` (step B3 of the data procedure; used for the new staging cluster on 2026-09-28).

### C1a — Wait for new DB ready

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  if PGPASSWORD=<prod password> psql "host=<prod host> port=<prod port> dbname=$DB_NAME user=doadmin sslmode=require" -c '\dt' >/dev/null 2>&1; then
    echo "READY"; break
  fi
  sleep 2
done
```

### C2 to C4 — Load and verify (Part B of the data procedure)

Follow [Part B of `docs/production-data-migration.md`](../../docs/production-data-migration.md#part-b--load-a-database), steps B1 and B4 to B9, with `ENV_FILE=.env.production` and the production connection string. B2 (backup) was done in pre-flight step 4b and B3 (empty the database) is C1 above.

| Step | What | Must show |
|---|---|---|
| B1 | Point `DSN`, `PGPASSWORD`, `DUMP` at production | `current_database()` is the production database |
| B4 | `npx env-cmd -f .env.production typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run` | every migration `executed successfully` |
| B5 | `./load-legacy-dump.sh "$DUMP" "$DSN"` | the checksum from pre-flight step 5, then the row counts |
| B6 | `python3 verify-against-mysql.py --pg-dsn "$DSN"` | `RESULT: PASS` |
| B7 | Re-run the three data migrations | exactly three `executed successfully` |
| B8 | Refresh the two materialized views | no error |
| B9 | Final checks | views equal to `orders`, 5 job sheet views, 0 fitters not normalized |

**If B6 does not say PASS, stop and roll back.** Do not repair rows by hand inside the window.

Steps that older versions of this runbook had and that are gone on purpose:

- Loading `postgres/data/*.sql` file by file with `psql`: per-row inserts over the network take hours for `log`, and errors were easy to miss. The dump loads with `COPY` in one transaction.
- A separate `COPY` for `orders_info` and a sequence reset: both are part of the dump, and B6 checks every sequence.
- `extract-seat-sizes.sh --env production`: seat sizes are filled in the build database and travel with the dump.

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
- `log` / `dblog` ↑ (legacy tables, part of the dump)
- NestJS-only tables (`audit_log`, `comment`, `report_saved_filters`, etc.) → 0 in new; `custom_order_views` → 5 (the job sheet tabs re-created in B7)
- Schema-defined empty tables → still 0

### C6 — Restore data that only existed in the old database (only if there is any)

If the database being replaced was already used through the new app, the tables outside the export held people's work: `comment`, `custom_order_views`, `custom_order_view_groups`, `custom_order_cell_overrides`, `report_saved_filters`, `warehouse`, `extras`, `saddle_extras`, `audit_log`. Decide per table before the window whether it must come back. Restore from the pre-flight backup with `pg_dump --data-only --table=<each>` and `psql`, as the June rehearsal did (rehearsal log, D5 and D6). This step was not part of the October 2026 rehearsals; rehearse it against a copy first.

For a first cutover, where nobody has worked in the new production database yet, skip C6.

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

If the verification (B6) fails or anything in C2–C5b looks wrong and you decide to abort:

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

## Known caveats

1. **Rows written through the new app into the old database are gone** unless restored in C6: `audit_log`, comments, custom views other than the seeded job sheets, saved report filters, runtime brand additions. The legacy tables, including `log` and `dblog`, come complete from the export.
2. **`brands` count differs from the old database by however many were added at runtime.** The export's count is authoritative.
3. **The managed database user is not a superuser.** Nothing in Part B needs one: the NestJS schema has no foreign keys on legacy tables, so no triggers have to be disabled.
4. **`NormalizeFitterCountries` has an open TODO** in its source (it maps only `NL`, `US` and `-1`). It changes 2 fitters of the 2026-09-23 export. Staging has it applied.
5. **`pg_dump` must not be older than the server.** The commands use `postgres:18`; keep that at or above the production server's major version.

## Owner

Update this section with the actual on-call for the cutover. Include:
- Primary executor
- Secondary (verify, type commands)
- Communication channel for the window (Slack channel, etc.)
- Customer comms plan (status page, banner, email)

---

*Generated from the staging rehearsal on 2026-06-18/19 ([`prod-migration-rehearsal-log.md`](prod-migration-rehearsal-log.md)); data steps replaced on 2026-10-05 by `docs/production-data-migration.md`.*
