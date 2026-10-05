# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Production export of the legacy OMS MySQL database (2,211,463 rows in 21 tables, export of 2026-09-23) and the pipeline that turns it into PostgreSQL data. The scripts, this file and the README are tracked. The data is not: `.gitignore` ignores everything here except a whitelist. Never commit data and never use `git add -f` in this folder; a new script only becomes trackable when it matches the whitelist.

**The procedure for a new export is `docs/production-data-migration.md` (tracked).** Follow it step by step. Do not use any other document, and do not improvise a second path. If you change a script here, rehearse the whole procedure in new containers before relying on it.

## The path

```text
export zip → oms_mysql_legacy → mysql-legacy/data → postgres/data → build database oms_build
          → verify-against-mysql.py (must PASS) → dump → each target → verify-against-mysql.py (must PASS)
```

## Commands (Part A of the procedure)

```bash
# MySQL side
cd mysql-legacy/scripts
./setup-mysql.sh --clean
unzip -p ../<export>.sql.zip | docker exec -i oms_mysql_legacy mysql --max_allowed_packet=512M --default-character-set=utf8mb4 -u oms_user -poms_password oms_legacy
docker exec oms_mysql_legacy mysql -u oms_user -poms_password oms_legacy -e "UPDATE FactoryEmployees fe JOIN Factories f ON f.UserID = fe.FactoryID SET fe.FactoryID = f.ID"
./export-table-files.sh

# PostgreSQL side
cd ../../postgres/scripts
./transform-mysql-to-postgres.sh
# build database: see the procedure (A6) for creating oms_build and running the migrations with .env.build
PG_USER=oms PG_DATABASE=oms_build ./import-data.sh --env local --data
python3 verify-against-mysql.py --pg-container backend-postgres-1 --pg-user oms --pg-database oms_build
PG_USER=oms PG_DATABASE=oms_build ./extract-seat-sizes.sh --env local --apply
./dump-legacy-data.sh
```

Loading a target (Part B): `./load-legacy-dump.sh <dump> "<connection string>"`, then `python3 verify-against-mysql.py --pg-dsn "<connection string>"`, then the data migrations and the view refresh as the procedure describes.

## Rules

- `--default-character-set=utf8mb4` on every `mysql` call that loads or reads text. The container's client defaults to latin1.
- Never set `DATABASE_*` in the shell for `npm run migration:run`; `env-cmd` lets `backend/.env` win. Use `npx env-cmd -f <env file> typeorm-ts-node-commonjs --dataSource=src/database/data-source.ts migration:run`.
- The gate is `verify-against-mysql.py`. Counts and samples are not proof.
- Never dump from a database that has seen seeds or the app. `oms_build` exists for that.
- The 16 orders and 3 customers pointing at deleted fitters, and the 52,431 `orders_info` rows of deleted orders, stay as they are.
- The 5433 container (`oms_postgres_legacy`), `sync-production-data.sh` and `transform-orders-booleans.py` are not part of the procedure.

## Connection Details

```text
MySQL:      127.0.0.1:3307  oms_legacy  oms_user / oms_password   container oms_mysql_legacy
PostgreSQL: 127.0.0.1:5432  oms_build (build) and oms_nest (dev)  user oms   container backend-postgres-1
```

## What the converter changes

`postgres/scripts/convert-mysql-to-pg.py` maps names to snake_case, writes `E''` literals, turns the six `orders` tinyint flags into booleans, drops NUL characters, writes Ctrl-Z as the raw character (PostgreSQL reads `E'\Z'` as the letter Z; fixed 2026-10-05), and repairs double-encoded UTF-8 (4,193 cells in the 2026-09-23 export). It aborts when a table's column list differs from `EXPECTED_COLUMNS`.

## Seat sizes

`orders.seat_sizes` (JSONB, European notation `["17", "17,5"]`) is filled by `extract-seat-sizes.sh` from `orders_info` option 1 (51,003 orders) and, as a fallback, from `special_notes` (9 orders): 51,012 of 51,339 orders. It is filled in the build database so it travels with the dump.

## Role IDs

1 fitter · 2 admin · 3 factory · 4 customsaddler · 5 supervisor · 6 user. The `role` table is created and filled by the migration `CreateRoleTable`, not by the export.

See `README.md` for the folder layout and troubleshooting.
