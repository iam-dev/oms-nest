#!/usr/bin/env python3
"""
Convert one `mysqldump --complete-insert --skip-extended-insert` table file
into PostgreSQL INSERT statements (one per line).

    python3 convert-mysql-to-pg.py <mysql-file> <postgres-file> [--limit N]

What it does per row:
  * maps the MySQL table and column names onto the NestJS snake_case schema and
    fails loudly if the dump's column list is not the one this script knows;
  * writes every string as an E'' literal so the MySQL backslash escapes
    (\\n, \\', \\\\ ...) keep their meaning in PostgreSQL;
  * drops NUL escapes (\\0), which PostgreSQL text cannot store (only DBlog has them);
  * writes MySQL's Ctrl-Z escape (\\Z) as the raw character, because PostgreSQL
    reads E'\\Z' as the letter Z (only DBlog has them);
  * turns tinyint 0/1 into true/false for the orders columns that migration
    AddLegacyBooleanFieldsToOrders1737900000000 made boolean;
  * repairs double-encoded UTF-8 ("Ã¶" for "ö") with the same cp1252 round-trip
    + strict UTF-8 test as backend/scripts/lib/double-encoded-utf8.ts, so the
    generated files are already clean and `npm run data:fix-utf8` finds nothing.

--limit N stops after N rows (used for the partial log/dblog files).
"""

import re
import sys
from typing import Dict, List, Optional, Tuple

# --------------------------------------------------------------------------
# Table / column mapping (MySQL CamelCase -> PostgreSQL snake_case)
# --------------------------------------------------------------------------

TABLES: Dict[str, str] = {
    "Brands": "brands",
    "LeatherTypes": "leather_types",
    "Options": "options",
    "OptionsItems": "options_items",
    "Presets": "presets",
    "PresetsItems": "presets_items",
    "Saddles": "saddles",
    "Factories": "factories",
    "FactoryEmployees": "factory_employees",
    "Fitters": "fitters",
    "Customers": "customers",
    "Orders": "orders",
    "OrdersInfo": "orders_info",
    "SaddleLeathers": "saddle_leathers",
    "SaddleOptionsItems": "saddle_options_items",
    "UserTypes": "user_types",
    "Statuses": "statuses",
    "Credentials": "credentials",
    "ClientConfirmation": "client_confirmation",
    "Log": "log",
    "DBlog": "dblog",
}

# Columns whose snake_case form is not the mechanical one.
COLUMN_OVERRIDES: Dict[str, Dict[str, str]] = {
    "Orders": {"OMSversion": "oms_version"},
    "UserTypes": {"UserTypeID": "id"},
}

# The exact PostgreSQL column list each table must map to (taken from the
# schema files and transform-mysql-to-postgres.sh). A mismatch means the dump
# gained or lost a column and the schema needs a look before importing.
EXPECTED_COLUMNS: Dict[str, List[str]] = {
    "brands": ["id", "brand_name"],
    "leather_types": ["id", "name", "sequence", "deleted"],
    "options": [
        "id", "name", "group", "price1", "price2", "price3", "price_contrast1",
        "price_contrast2", "price_contrast3", "sequence", "type", "extra_allowed",
        "deleted", "price4", "price5", "price6", "price7", "price_contrast4",
        "price_contrast5", "price_contrast6", "price_contrast7",
    ],
    "options_items": [
        "id", "option_id", "leather_id", "name", "user_color", "user_leather",
        "price1", "price2", "price3", "sequence", "deleted", "restrict", "price4",
        "price5", "price6", "price7",
    ],
    "presets": ["id", "name", "sequence", "deleted"],
    "presets_items": ["options_id", "item_id", "preset_id"],
    "saddles": [
        "id", "factory_eu", "factory_gb", "factory_us", "brand", "model_name",
        "presets", "active", "type", "deleted", "sequence", "factory_ca",
        "factory_aud", "factory_de", "factory_nl",
    ],
    "factories": [
        "id", "user_id", "deleted", "address", "zipcode", "state", "city", "country",
        "phone_no", "cell_no", "currency", "emailaddress",
    ],
    "factory_employees": ["id", "deleted", "name", "factory_id"],
    "fitters": [
        "id", "user_id", "deleted", "address", "zipcode", "state", "city", "country",
        "phone_no", "cell_no", "currency", "emailaddress",
    ],
    "customers": [
        "id", "deleted", "fitter_id", "horse_name", "name", "address", "company",
        "city", "country", "state", "zipcode", "email", "phone_no", "cell_no",
        "bank_account_number",
    ],
    "orders": [
        "id", "fitter_id", "saddle_id", "leather_id", "factory_id", "fitter_stock",
        "customer_id", "shipped_by_employee", "fitter_reference", "last_seen_fitter",
        "last_seen_cs", "last_seen_factory", "horse_name", "name", "address",
        "zipcode", "city", "state", "country", "phone_no", "cell_no", "email",
        "order_status", "ship_name", "ship_address", "ship_zipcode", "ship_city",
        "ship_state", "ship_country", "order_time", "payment", "payment_time",
        "order_step", "price_saddle", "price_tradein", "price_deposit",
        "price_discount", "price_fittingeval", "price_callfee", "price_girth",
        "price_shipping", "price_tax", "price_additional", "special_notes",
        "serial_number", "custom_order", "changed", "repair", "demo", "sponsored",
        "rushed", "oms_version", "currency", "order_data",
    ],
    "orders_info": [
        "order_id", "option_id", "option_item_id", "clone_number", "color",
        "leathertype", "custom",
    ],
    "saddle_leathers": [
        "id", "saddle_id", "leather_id", "price1", "price2", "price3", "sequence",
        "deleted", "price4", "price5", "price6", "price7",
    ],
    "saddle_options_items": [
        "id", "saddle_id", "option_id", "option_item_id", "leather_id", "sequence",
        "deleted",
    ],
    "user_types": ["id", "type_description"],
    "statuses": ["id", "name", "factory_hidden", "factory_alternative_name", "sequence"],
    "credentials": [
        "user_id", "deleted", "user_type", "user_name", "full_name", "password_hash",
        "last_login", "blocked", "password_reset_hash", "password_reset_valid_to",
        "supervisor",
    ],
    "client_confirmation": [
        "id", "uid", "customer_id", "order_id", "confirmed", "send_time",
        "confirm_time", "sign",
    ],
    "log": [
        "id", "user_id", "user_type", "only_for", "order_id", "text", "time",
        "order_status_updated_from", "order_status_updated_to",
    ],
    "dblog": ["id", "query", "user", "timestamp", "page", "backtrace"],
}

# tinyint columns that are boolean in the NestJS schema (by PostgreSQL name).
BOOLEAN_COLUMNS: Dict[str, set] = {
    "orders": {"fitter_stock", "custom_order", "repair", "demo", "sponsored", "rushed"},
}

CAMEL_BOUNDARY = re.compile(r"([a-z0-9])([A-Z])")


def snake_case(table: str, column: str) -> str:
    override = COLUMN_OVERRIDES.get(table, {}).get(column)
    if override:
        return override
    return CAMEL_BOUNDARY.sub(r"\1_\2", column).lower()


# --------------------------------------------------------------------------
# Double-encoded UTF-8 repair (port of backend/scripts/lib/double-encoded-utf8.ts)
# --------------------------------------------------------------------------

CP1252_TO_BYTE = {
    0x20AC: 0x80, 0x201A: 0x82, 0x0192: 0x83, 0x201E: 0x84, 0x2026: 0x85,
    0x2020: 0x86, 0x2021: 0x87, 0x02C6: 0x88, 0x2030: 0x89, 0x0160: 0x8A,
    0x2039: 0x8B, 0x0152: 0x8C, 0x017D: 0x8E, 0x2018: 0x91, 0x2019: 0x92,
    0x201C: 0x93, 0x201D: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
    0x02DC: 0x98, 0x2122: 0x99, 0x0161: 0x9A, 0x203A: 0x9B, 0x0153: 0x9C,
    0x017E: 0x9E, 0x0178: 0x9F,
}
MAX_LEVELS = 6


def decode_once(value: str) -> Optional[str]:
    """One decoding pass; None when the text is not a cp1252 rendering of valid UTF-8."""
    out = bytearray()
    for ch in value:
        code = ord(ch)
        if code <= 0xFF:
            out.append(code)
        elif code in CP1252_TO_BYTE:
            out.append(CP1252_TO_BYTE[code])
        else:
            return None
    try:
        return bytes(out).decode("utf-8")  # strict
    except UnicodeDecodeError:
        return None


def repair_double_encoded_utf8(value: str) -> Tuple[str, int]:
    current = value
    levels = 0
    while levels < MAX_LEVELS and not current.isascii():
        nxt = decode_once(current)
        if nxt is None or nxt == current:
            break
        current = nxt
        levels += 1
    return current, levels


# --------------------------------------------------------------------------
# INSERT line parsing (same rules as backend/scripts/lib/mysql-dump.ts)
# --------------------------------------------------------------------------

INSERT_HEAD = re.compile(r"^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES \(")
OUTSIDE = re.compile(r"[',)]")
INSIDE = re.compile(r"[\\']")
ESCAPE = re.compile(r"\\(.)", re.DOTALL)


def split_tuple(body: str) -> Optional[List[str]]:
    """Split the VALUES body on top-level commas, honouring quotes and backslash escapes."""
    values: List[str] = []
    start = 0
    i = 0
    while True:
        m = OUTSIDE.search(body, i)
        if not m:
            return None
        ch = m.group()
        j = m.start()
        if ch == "'":
            k = j + 1
            while True:
                m2 = INSIDE.search(body, k)
                if not m2:
                    return None
                if m2.group() == "\\":
                    k = m2.start() + 2  # escape: skip the next character whatever it is
                    continue
                k = m2.start() + 1  # closing quote
                break
            i = k
        elif ch == ",":
            values.append(body[start:j].strip())
            start = j + 1
            i = start
        else:  # ')'
            values.append(body[start:j].strip())
            return values


class Stats:
    rows = 0
    skipped = 0
    repaired_cells = 0
    nul_stripped = 0


def pg_value(token: str, is_boolean: bool, stats: Stats) -> str:
    if len(token) >= 2 and token[0] == "'" and token[-1] == "'":
        inner = token[1:-1]
        if "\\0" in inner or "\\Z" in inner:
            def fix_escape(m: "re.Match[str]") -> str:
                if m.group(1) == "0":
                    stats.nul_stripped += 1
                    return ""
                if m.group(1) == "Z":
                    return "\x1a"  # written raw: E'\Z' would be a plain Z in PostgreSQL
                return m.group(0)
            inner = ESCAPE.sub(fix_escape, inner)
        if not inner.isascii():
            inner, levels = repair_double_encoded_utf8(inner)
            if levels:
                stats.repaired_cells += 1
        return "E'" + inner + "'"
    if is_boolean and token in ("0", "1"):
        return "true" if token == "1" else "false"
    return token


def convert(src: str, dst: str, limit: Optional[int]) -> Stats:
    stats = Stats()
    columns_sql: Optional[str] = None
    pg_table: Optional[str] = None
    boolean_flags: List[bool] = []

    with open(src, "r", encoding="utf-8") as fin, open(dst, "w", encoding="utf-8") as fout:
        fout.write(
            "-- =============================================================================\n"
            "-- PostgreSQL Data Import\n"
            "-- =============================================================================\n"
            "-- Generated by convert-mysql-to-pg.py from " + src.split("/")[-1] + "\n"
            "-- Strings are E'' literals; double-encoded UTF-8 already repaired.\n"
            "-- =============================================================================\n\n"
        )
        for line in fin:
            if not line.startswith("INSERT INTO"):
                continue
            head = INSERT_HEAD.match(line)
            if not head:
                stats.skipped += 1
                continue
            if columns_sql is None:
                mysql_table = head.group(1)
                pg_table = TABLES.get(mysql_table)
                if not pg_table:
                    raise SystemExit(f"{src}: no mapping for MySQL table {mysql_table}")
                mysql_cols = [c.strip().strip("`") for c in head.group(2).split(",")]
                pg_cols = [snake_case(mysql_table, c) for c in mysql_cols]
                expected = EXPECTED_COLUMNS[pg_table]
                if pg_cols != expected:
                    raise SystemExit(
                        f"{src}: column list of {mysql_table} changed.\n"
                        f"  dump:     {pg_cols}\n  expected: {expected}\n"
                        "  Update the PostgreSQL schema and EXPECTED_COLUMNS before importing."
                    )
                columns_sql = ", ".join(f'"{c}"' for c in pg_cols)
                bools = BOOLEAN_COLUMNS.get(pg_table, set())
                boolean_flags = [c in bools for c in pg_cols]
            values = split_tuple(line[head.end():])
            if values is None or len(values) != len(boolean_flags):
                stats.skipped += 1
                sys.stderr.write(f"WARN {src}: could not parse row: {line[:120]}\n")
                continue
            converted = [pg_value(v, boolean_flags[i], stats) for i, v in enumerate(values)]
            fout.write(f'INSERT INTO "{pg_table}" ({columns_sql}) VALUES ({", ".join(converted)});\n')
            stats.rows += 1
            if limit is not None and stats.rows >= limit:
                break
    return stats


def main(argv: List[str]) -> int:
    if len(argv) < 3:
        sys.stderr.write(__doc__)
        return 2
    src, dst = argv[1], argv[2]
    limit = None
    if "--limit" in argv:
        limit = int(argv[argv.index("--limit") + 1])
    stats = convert(src, dst, limit)
    print(
        f"  {dst.split('/')[-1]}: {stats.rows} rows, {stats.repaired_cells} cells with "
        f"double-encoded UTF-8 repaired, {stats.nul_stripped} NUL escapes dropped, "
        f"{stats.skipped} lines skipped"
    )
    return 1 if stats.skipped else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
