#!/usr/bin/env python3
"""
Prove that a PostgreSQL database holds exactly the rows of the legacy MySQL database.

    python3 verify-against-mysql.py --pg-container oms_postgres_legacy --pg-user oms_user --pg-database oms_legacy
    python3 verify-against-mysql.py --pg-container backend-postgres-1 --pg-user oms --pg-database oms_nest
    PGPASSWORD=... python3 verify-against-mysql.py --pg-dsn "host=... port=25060 dbname=... user=... sslmode=require"

Every row of the 21 legacy tables is read from both sides and compared cell by cell
(not counts or samples). The MySQL value is first put through the only changes the
pipeline is allowed to make:
  * double-encoded UTF-8 is repaired (same function as convert-mysql-to-pg.py);
  * NUL characters are dropped (PostgreSQL text cannot store them, DBlog only);
  * the six orders tinyint flags become booleans.
Anything else that differs is reported and the script exits 1. Columns that only
exist in the NestJS schema (created_at, seat_sizes, ...) are ignored.

It also checks that every SERIAL sequence is past MAX(id), so the first insert
by the application cannot collide with an imported row.

--repairs FILE writes one line per repaired cell (table, key, before, after) for review.
--allow-extra lets the target hold rows MySQL does not have (a dev database with seed
users); missing or different rows still fail.
"""

import argparse
import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
from collections import Counter
from typing import Dict, Iterator, List, Optional, Tuple

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

_spec = importlib.util.spec_from_file_location(
    "convert_mysql_to_pg", os.path.join(SCRIPT_DIR, "convert-mysql-to-pg.py")
)
converter = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(converter)

# Primary key (PostgreSQL names) used to label rows in reports; None = no key.
KEYS: Dict[str, Optional[List[str]]] = {
    "credentials": ["user_id"],
    "orders_info": ["order_id", "option_id", "option_item_id", "clone_number"],
    "presets_items": None,
}

# psql for --pg-dsn when none is installed locally (override with PSQL_IMAGE)
PSQL_IMAGE = os.environ.get("PSQL_IMAGE", "postgres:17.6-alpine")
SAMPLES = 5


class Source:
    """The legacy MySQL database inside its Docker container."""

    def __init__(self, args: argparse.Namespace) -> None:
        self.base = [
            "docker", "exec", "-e", f"MYSQL_PWD={args.mysql_password}", args.mysql_container,
            "mysql", "-u", args.mysql_user, "--default-character-set=utf8mb4",
            "--batch", "--raw", "--skip-column-names", "--quick", args.mysql_database,
        ]
        self.database = args.mysql_database

    def lines(self, sql: str) -> Iterator[str]:
        return run_lines(self.base + ["-e", sql])

    def tables(self) -> List[str]:
        sql = (
            "SELECT table_name FROM information_schema.tables "
            f"WHERE table_schema = '{self.database}' AND table_type = 'BASE TABLE' ORDER BY 1"
        )
        return list(self.lines(sql))

    def columns(self, table: str) -> List[str]:
        sql = (
            "SELECT column_name FROM information_schema.columns "
            f"WHERE table_schema = '{self.database}' AND table_name = '{table}' "
            "ORDER BY ordinal_position"
        )
        return list(self.lines(sql))

    def rows(self, table: str, columns: List[str]) -> Iterator[list]:
        cols = ", ".join(f"`{c}`" for c in columns)
        for line in self.lines(f"SELECT JSON_ARRAY({cols}) FROM `{table}`"):
            yield json.loads(line)


class Target:
    """The PostgreSQL database: a local container (docker exec) or any server (DSN)."""

    def __init__(self, args: argparse.Namespace) -> None:
        if args.pg_dsn:
            if shutil.which("psql"):
                self.base = ["psql", args.pg_dsn]
            else:
                self.base = [
                    "docker", "run", "--rm", "-i", "-e", "PGPASSWORD", "-e", "PGOPTIONS",
                    "--add-host", "host.docker.internal:host-gateway",
                    PSQL_IMAGE, "psql", args.pg_dsn,
                ]
            self.label = args.pg_dsn.split("password")[0].strip()
        else:
            self.base = [
                "docker", "exec", "-i", args.pg_container,
                "psql", "-U", args.pg_user, "-d", args.pg_database,
            ]
            self.label = f"{args.pg_container}/{args.pg_database}"
        self.base += ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-v", "FETCH_COUNT=5000"]

    def lines(self, sql: str) -> Iterator[str]:
        return run_lines(self.base + ["-c", sql])

    def rows(self, table: str, columns: List[str]) -> Iterator[list]:
        cols = ", ".join(f'"{c}"' for c in columns)
        for line in self.lines(f'SELECT json_build_array({cols})::text FROM "{table}"'):
            yield json.loads(line)


def run_lines(cmd: List[str]) -> Iterator[str]:
    proc = subprocess.Popen(cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, encoding="utf-8")
    assert proc.stdout is not None and proc.stderr is not None
    for line in proc.stdout:
        yield line.rstrip("\n")
    stderr = proc.stderr.read()
    if proc.wait() != 0:
        raise SystemExit(f"command failed ({proc.returncode}): {' '.join(cmd[:8])} ...\n{stderr.strip()}")


def digest(row: list) -> bytes:
    return hashlib.md5(json.dumps(row, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).digest()


class TableResult:
    def __init__(self, table: str) -> None:
        self.table = table
        self.source_rows = 0
        self.target_rows = 0
        self.repaired = 0
        self.nul = 0
        self.booleans = 0
        self.missing = 0  # in MySQL, not (identically) in PostgreSQL
        self.extra = 0  # in PostgreSQL, not in MySQL
        self.extra_samples: List[list] = []
        self.missing_samples: List[list] = []


def expected_row(row: list, bool_flags: List[bool], result: TableResult,
                 key_of, pg_table: str, repairs) -> list:
    """Apply the transformations the pipeline is allowed to make to one MySQL row."""
    out = []
    for i, value in enumerate(row):
        if isinstance(value, str):
            original = value
            if "\x00" in value:
                result.nul += value.count("\x00")
                value = value.replace("\x00", "")
            if not value.isascii():
                value, levels = converter.repair_double_encoded_utf8(value)
                if levels:
                    result.repaired += 1
                    if repairs is not None:
                        repairs.write(json.dumps(
                            [pg_table, key_of(row), i, original, value], ensure_ascii=False) + "\n")
        elif bool_flags[i] and value in (0, 1):
            value = bool(value)
            result.booleans += 1
        out.append(value)
    return out


def compare_table(source: Source, target: Target, mysql_table: str, repairs) -> TableResult:
    pg_table = converter.TABLES[mysql_table]
    result = TableResult(pg_table)
    mysql_cols = source.columns(mysql_table)
    pg_cols = [converter.snake_case(mysql_table, c) for c in mysql_cols]
    if pg_cols != converter.EXPECTED_COLUMNS[pg_table]:
        raise SystemExit(
            f"{mysql_table}: column list changed.\n  mysql:    {pg_cols}\n"
            f"  expected: {converter.EXPECTED_COLUMNS[pg_table]}"
        )
    bools = converter.BOOLEAN_COLUMNS.get(pg_table, set())
    bool_flags = [c in bools for c in pg_cols]
    key_cols = KEYS.get(pg_table, ["id"])
    key_idx = [pg_cols.index(c) for c in key_cols] if key_cols else []

    def key_of(row: list) -> list:
        return [row[i] for i in key_idx]

    wanted: Counter = Counter()
    for row in source.rows(mysql_table, mysql_cols):
        result.source_rows += 1
        wanted[digest(expected_row(row, bool_flags, result, key_of, pg_table, repairs))] += 1

    for row in target.rows(pg_table, pg_cols):
        result.target_rows += 1
        d = digest(row)
        if wanted.get(d, 0) > 0:
            wanted[d] -= 1
        else:
            result.extra += 1
            if len(result.extra_samples) < SAMPLES:
                result.extra_samples.append(row)

    result.missing = sum(wanted.values())
    if result.missing:
        # second pass over MySQL only when something is wrong, to show which rows
        scratch = TableResult(pg_table)
        for row in source.rows(mysql_table, mysql_cols):
            exp = expected_row(row, bool_flags, scratch, key_of, pg_table, None)
            if wanted.get(digest(exp), 0) > 0:
                wanted[digest(exp)] -= 1
                result.missing_samples.append(exp)
                if len(result.missing_samples) >= SAMPLES:
                    break
    return result


def check_sequences(target: Target) -> List[str]:
    """Every sequence owned by a legacy table column must be past MAX(column)."""
    sql = (
        "SELECT s.relname, t.relname, a.attname FROM pg_class s "
        "JOIN pg_namespace n ON n.oid = s.relnamespace "
        "JOIN pg_depend d ON d.objid = s.oid AND d.deptype IN ('a', 'i') "
        "JOIN pg_class t ON t.oid = d.refobjid "
        "JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid "
        "WHERE s.relkind = 'S' AND n.nspname = 'public' ORDER BY 1"
    )
    legacy = set(converter.TABLES.values())
    problems = []
    checked = 0
    for line in target.lines(sql):
        seq, table, column = line.split("|")
        if table not in legacy:
            continue
        row = next(target.lines(
            f'SELECT COALESCE((SELECT MAX("{column}") FROM "{table}"), 0), last_value, is_called FROM "{seq}"'
        ))
        max_id, last_value, is_called = row.split("|")
        next_value = int(last_value) + (1 if is_called == "t" else 0)
        checked += 1
        if int(max_id) > 0 and next_value <= int(max_id):
            problems.append(f"{seq}: next value {next_value} <= MAX({table}.{column}) = {max_id}")
    print(f"\nSequences: {checked} checked, {len(problems)} behind")
    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mysql-container", default="oms_mysql_legacy")
    parser.add_argument("--mysql-user", default="oms_user")
    parser.add_argument("--mysql-password", default="oms_password")
    parser.add_argument("--mysql-database", default="oms_legacy")
    parser.add_argument("--pg-container", default="oms_postgres_legacy")
    parser.add_argument("--pg-user", default="oms_user")
    parser.add_argument("--pg-database", default="oms_legacy")
    parser.add_argument("--pg-dsn", help="libpq connection string for a remote server (password via PGPASSWORD)")
    parser.add_argument("--tables", help="comma separated MySQL table names (default: all)")
    parser.add_argument("--repairs", help="write every repaired cell to this file (JSON lines)")
    parser.add_argument("--allow-extra", action="store_true",
                        help="rows that only exist in PostgreSQL are reported but do not fail the check")
    args = parser.parse_args()

    source = Source(args)
    target = Target(args)

    in_mysql = source.tables()
    unknown = [t for t in in_mysql if t not in converter.TABLES]
    absent = [t for t in converter.TABLES if t not in in_mysql]
    if unknown or absent:
        raise SystemExit(f"table set changed: not in the pipeline {unknown}, not in MySQL {absent}")
    tables = args.tables.split(",") if args.tables else list(converter.TABLES)

    print(f"Source: MySQL {args.mysql_container}/{args.mysql_database}")
    print(f"Target: PostgreSQL {target.label}\n")
    header = f"{'table':<22}{'mysql':>10}{'postgres':>10}{'repaired':>10}{'booleans':>10}{'NUL':>7}{'missing':>9}{'extra':>7}  status"
    print(header)
    print("-" * len(header))

    repairs = open(args.repairs, "w", encoding="utf-8") if args.repairs else None
    failed = False
    totals = [0, 0, 0]
    details: List[str] = []
    for mysql_table in tables:
        r = compare_table(source, target, mysql_table, repairs)
        bad = r.missing > 0 or (r.extra > 0 and not args.allow_extra)
        failed = failed or bad
        status = "FAIL" if bad else ("OK (extra rows allowed)" if r.extra else "OK")
        print(f"{r.table:<22}{r.source_rows:>10}{r.target_rows:>10}{r.repaired:>10}{r.booleans:>10}"
              f"{r.nul:>7}{r.missing:>9}{r.extra:>7}  {status}", flush=True)
        totals[0] += r.source_rows
        totals[1] += r.target_rows
        totals[2] += r.repaired
        for label, samples in (("expected (from MySQL)", r.missing_samples), ("found in PostgreSQL", r.extra_samples)):
            for row in samples:
                details.append(f"  {r.table} {label}: {json.dumps(row, ensure_ascii=False)[:400]}")
    if repairs is not None:
        repairs.close()
    print("-" * len(header))
    print(f"{'total':<22}{totals[0]:>10}{totals[1]:>10}{totals[2]:>10}")

    if details:
        print("\nSample rows that differ:")
        print("\n".join(details))

    sequence_problems = check_sequences(target)
    for p in sequence_problems:
        print(f"  {p}")

    if failed or sequence_problems:
        print("\nRESULT: FAIL - the PostgreSQL database is NOT a faithful copy.")
        return 1
    print("\nRESULT: PASS - every legacy row and cell matches MySQL.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
