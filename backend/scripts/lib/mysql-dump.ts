/**
 * Parsing helpers for `mysqldump --complete-insert --skip-extended-insert`
 * output, used by `scripts/import-mysql-data.ts`.
 *
 * Each INSERT is one line: INSERT INTO `T` (`a`, `b`) VALUES (1,'x\'y',NULL);
 * String literals use MySQL backslash escapes, which PostgreSQL only accepts in
 * E'' strings, so literals are re-emitted as E'...'.
 */

import { repairDoubleEncodedUtf8 } from "./double-encoded-utf8";

export interface ParsedInsert {
  table: string;
  columns: string[];
  /** Raw value tokens exactly as written in the dump ("1", "'a\\'b'", "NULL"). */
  values: string[];
}

const INSERT_HEAD = /^INSERT INTO `([^`]+)` \(([^)]*)\) VALUES \(/;

/**
 * Split the body of a VALUES tuple on top-level commas, honouring quotes and
 * backslash escapes. Returns null when the tuple is not closed.
 */
function splitTuple(body: string): string[] | null {
  const values: string[] = [];
  let current = "";
  let inString = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      current += ch;
      if (ch === "\\") {
        // escape: copy the next character verbatim, whatever it is
        current += body[++i] ?? "";
      } else if (ch === "'") {
        inString = false;
      }
      continue;
    }
    if (ch === "'") {
      inString = true;
      current += ch;
    } else if (ch === ",") {
      values.push(current.trim());
      current = "";
    } else if (ch === ")") {
      values.push(current.trim());
      return values;
    } else {
      current += ch;
    }
  }
  return null;
}

export function parseInsertLine(line: string): ParsedInsert | null {
  const head = line.match(INSERT_HEAD);
  if (!head) return null;
  const columns = head[2].split(",").map((c) => c.trim().replace(/`/g, ""));
  const values = splitTuple(line.slice(head[0].length));
  if (!values) return null;
  return { table: head[1], columns, values };
}

export interface PgValue {
  sql: string;
  /** True when double-encoded UTF-8 was repaired inside a string literal. */
  repaired: boolean;
}

/**
 * Convert one raw MySQL value token to PostgreSQL SQL text. Boolean columns
 * receive true/false for MySQL's tinyint 0/1.
 */
export function toPgValue(token: string, isBoolean: boolean): PgValue {
  if (token.startsWith("'") && token.endsWith("'")) {
    const inner = token.slice(1, -1);
    const { value, levels } = repairDoubleEncodedUtf8(inner);
    return { sql: `E'${value}'`, repaired: levels > 0 };
  }
  if (isBoolean && (token === "0" || token === "1")) {
    return { sql: token === "1" ? "true" : "false", repaired: false };
  }
  return { sql: token, repaired: false };
}
