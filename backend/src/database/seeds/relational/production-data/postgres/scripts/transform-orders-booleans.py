#!/usr/bin/env python3
"""
Transform orders.sql boolean columns from integer (0, 1) to PostgreSQL boolean (false, true).

Handles BOTH per-row INSERTs and extended-INSERTs, and BOTH formats that may appear:

  Per-row positional:
    INSERT INTO "orders" VALUES (1,2,3,...);

  Per-row with column list:
    INSERT INTO "orders" (id, fitter_id, fitter_stock, ...) VALUES (1,2,false,...);

  Extended (multi-row):
    INSERT INTO "orders" VALUES (1,2,3,...),(4,5,6,...),...;

Boolean columns (must match migration AddLegacyBooleanFieldsToOrders1737900000000):
  fitter_stock, custom_order, repair, demo, sponsored, rushed

Strategy:
- If the INSERT has an explicit column list, detect booleans **by column name** (robust to
  trailing-backslash edge cases like cell_no='a\\' that confuse positional parsers).
- If positional, fall back to schema-known positions (5, 45, 47, 48, 49, 50).

Usage:
    python3 transform-orders-booleans.py                       # transform default path
    python3 transform-orders-booleans.py path/to/orders.sql    # custom path
"""

import os
import re
import shutil
import sys
from typing import List, Optional, Tuple

# Boolean column NAMES (preferred, robust)
BOOL_COLS = {"fitter_stock", "custom_order", "repair", "demo", "sponsored", "rushed"}
# Boolean column 0-indexed POSITIONS (fallback for positional INSERTs)
BOOL_POS = {5, 45, 47, 48, 49, 50}


def parse_values(s: str) -> List[str]:
    """Parse comma-separated VALUES content respecting single-quoted strings.

    Inside a string, a backslash + any next char is consumed as a unit (the
    MySQL-dump convention). This avoids the classic 'CUSTOMER BUCK\\' bug
    where a trailing backslash in the data fools a naive parser into
    skipping the closing quote.
    """
    out: List[str] = []
    cur: List[str] = []
    in_str = False
    i = 0
    n = len(s)
    while i < n:
        c = s[i]
        if in_str:
            if c == "\\" and i + 1 < n:
                cur.append(c)
                cur.append(s[i + 1])
                i += 2
                continue
            if c == "'" and i + 1 < n and s[i + 1] == "'":
                cur.append("''")
                i += 2
                continue
            if c == "'":
                in_str = False
                cur.append(c)
                i += 1
                continue
            cur.append(c)
            i += 1
        else:
            if c == ",":
                out.append("".join(cur).strip())
                cur = []
                i += 1
                continue
            if c == "'":
                in_str = True
                cur.append(c)
                i += 1
                continue
            cur.append(c)
            i += 1
    out.append("".join(cur).strip())
    return out


def split_value_groups(values_body: str) -> List[str]:
    """Split a top-level VALUES body like '(a,b,c),(d,e,f)' into ['a,b,c','d,e,f'].

    Respects strings and nested parens.
    """
    groups: List[str] = []
    depth = 0
    cur: List[str] = []
    in_str = False
    i = 0
    n = len(values_body)
    while i < n:
        c = values_body[i]
        if in_str:
            if c == "\\" and i + 1 < n:
                cur.append(c)
                cur.append(values_body[i + 1])
                i += 2
                continue
            if c == "'" and i + 1 < n and values_body[i + 1] == "'":
                cur.append("''")
                i += 2
                continue
            if c == "'":
                in_str = False
            cur.append(c)
            i += 1
            continue
        if c == "'":
            in_str = True
            cur.append(c)
            i += 1
            continue
        if c == "(":
            if depth == 0:
                cur = []
            else:
                cur.append(c)
            depth += 1
            i += 1
            continue
        if c == ")":
            depth -= 1
            if depth == 0:
                groups.append("".join(cur))
            else:
                cur.append(c)
            i += 1
            continue
        if depth > 0:
            cur.append(c)
        i += 1
    return groups


def to_bool(v: str) -> str:
    v = v.strip()
    if v == "0":
        return "false"
    if v == "1":
        return "true"
    return v


INSERT_RE = re.compile(
    r'^(\s*INSERT\s+INTO\s+"orders"\s*)(\(([^)]+)\)\s*)?VALUES\s*(.+?)\s*;\s*$',
    re.IGNORECASE | re.DOTALL,
)


def transform_line(line: str) -> Tuple[str, bool, Optional[str]]:
    """Transform a single INSERT line. Returns (new_line, was_transformed, error)."""
    m = INSERT_RE.match(line)
    if not m:
        return line, False, None

    prefix = m.group(1)
    col_paren = m.group(2)
    col_list_str = m.group(3)
    values_body = m.group(4)

    col_positions: Optional[List[int]] = None
    if col_list_str is not None:
        cols = [c.strip().strip('"').strip("`").strip() for c in col_list_str.split(",")]
        col_positions = [i for i, c in enumerate(cols) if c in BOOL_COLS]

    groups = split_value_groups(values_body)
    if not groups:
        return line, False, f"no value groups parsed in: {line[:80]}"

    new_groups = []
    for g in groups:
        vals = parse_values(g)
        if col_positions is None:
            if len(vals) < 51:
                new_groups.append(g)
                continue
            for p in BOOL_POS:
                vals[p] = to_bool(vals[p])
        else:
            if col_positions and max(col_positions) >= len(vals):
                new_groups.append(g)
                continue
            for p in col_positions:
                vals[p] = to_bool(vals[p])
        new_groups.append(",".join(vals))

    new_values_body = ",".join(f"({g})" for g in new_groups)
    col_part = col_paren if col_paren else ""
    new_line = f"{prefix}{col_part}VALUES {new_values_body};\n"
    return new_line, True, None


def transform_file(path: str) -> Tuple[int, int, List[str]]:
    """Transform orders.sql in place. Returns (total_inserts, transformed, errors)."""
    tmp = path + ".tmp"
    total = 0
    transformed = 0
    errors: List[str] = []
    with open(path, "r", encoding="utf-8") as f_in, open(tmp, "w", encoding="utf-8") as f_out:
        for line in f_in:
            if "INSERT" not in line or '"orders"' not in line:
                f_out.write(line)
                continue
            new_line, ok, err = transform_line(line)
            f_out.write(new_line)
            if err:
                errors.append(err)
            total += 1
            if ok:
                transformed += 1
    os.replace(tmp, path)
    return total, transformed, errors


def main() -> int:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    default_path = os.path.join(script_dir, "..", "data", "core-business", "orders.sql")
    orders_file = sys.argv[1] if len(sys.argv) > 1 else default_path

    if not os.path.exists(orders_file):
        print(f"Error: orders.sql not found at {orders_file}", file=sys.stderr)
        return 1

    print(f"Transforming boolean columns in: {orders_file}")
    print(f"Boolean columns (by name): {sorted(BOOL_COLS)}")
    print(f"Boolean positions (positional fallback): {sorted(BOOL_POS)}")
    print()

    backup = orders_file + ".preboolean"
    if not os.path.exists(backup):
        shutil.copy2(orders_file, backup)
        print(f"Created backup: {backup}")

    total, transformed, errors = transform_file(orders_file)
    print()
    print(f"INSERT lines seen:   {total}")
    print(f"Transformed:         {transformed}")
    print(f"Errors / skipped:    {len(errors)}")
    if errors:
        for e in errors[:10]:
            print(f"  - {e}")
        if len(errors) > 10:
            print(f"  ... and {len(errors) - 10} more")
    if transformed == 0:
        print("WARNING: no rows transformed. Did the orders.sql format change?", file=sys.stderr)
        return 1
    print("\nDone!")
    return 0


if __name__ == "__main__":
    sys.exit(main())
