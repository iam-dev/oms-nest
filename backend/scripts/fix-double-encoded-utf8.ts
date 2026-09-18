/**
 * Repair double-encoded UTF-8 in an already-imported PostgreSQL database.
 *
 * `import-mysql-data.ts` repairs rows as they are imported; this script is for
 * databases that were populated before that fix existed (staging was seeded
 * from the June 2026 dump this way). It scans every text column of every base
 * table that has a primary key, decodes values with
 * `scripts/lib/double-encoded-utf8.ts`, and reports what it would change.
 *
 * Usage (reads DATABASE_* from the environment, like the app):
 *   npm run data:fix-utf8                     # dry run, report only
 *   npm run data:fix-utf8 -- --apply          # write changes in one transaction
 *   npm run data:fix-utf8 -- --apply --rollback-file ./utf8-rollback.json
 *   npm run data:fix-utf8 -- --table orders,customers
 *   npm run data:fix-utf8 -- --restore ./utf8-rollback.json   # undo a previous --apply
 *
 * Before applying, the previous value of every cell is written to the rollback
 * file. Each UPDATE is guarded on the previous value, so a row edited between
 * scan and apply is skipped rather than clobbered. Materialized views are
 * refreshed afterwards because they snapshot the repaired columns.
 */

import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";
import * as dotenv from "dotenv";
import { repairDoubleEncodedUtf8 } from "./lib/double-encoded-utf8";

dotenv.config();

interface CellRepair {
  table: string;
  column: string;
  key: Record<string, unknown>;
  before: string;
  after: string;
  levels: number;
}

interface Options {
  apply: boolean;
  rollbackFile: string;
  restoreFile: string | null;
  tables: string[] | null;
}

function parseArgs(argv: string[]): Options {
  const apply = argv.includes("--apply");
  const at = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    apply,
    rollbackFile:
      at("--rollback-file") ?? path.resolve(`utf8-rollback-${stamp}.json`),
    restoreFile: at("--restore") ?? null,
    tables:
      at("--table")
        ?.split(",")
        .map((t) => t.trim()) ?? null,
  };
}

function createClient(): Client {
  return new Client({
    host: process.env.DATABASE_HOST || "localhost",
    port: parseInt(process.env.DATABASE_PORT || "5432", 10),
    database: process.env.DATABASE_NAME || "oms",
    user: process.env.DATABASE_USERNAME || "postgres",
    password: process.env.DATABASE_PASSWORD || "postgres",
    ssl:
      process.env.DATABASE_SSL_ENABLED === "true"
        ? {
            rejectUnauthorized:
              process.env.DATABASE_REJECT_UNAUTHORIZED === "true",
            ca: process.env.DATABASE_CA?.replace(/\\n/g, "\n") ?? undefined,
          }
        : undefined,
  });
}

const q = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

async function loadTextColumns(client: Client, only: string[] | null) {
  const { rows } = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `SELECT c.table_name, c.column_name
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND t.table_type = 'BASE TABLE'
        AND c.data_type IN ('text', 'character varying', 'character')
      ORDER BY c.table_name, c.ordinal_position`,
  );
  return only ? rows.filter((r) => only.includes(r.table_name)) : rows;
}

async function loadPrimaryKeys(
  client: Client,
): Promise<Record<string, string[]>> {
  const { rows } = await client.query<{
    table_name: string;
    column_name: string;
  }>(
    `SELECT tc.table_name, kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
      WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY tc.table_name, kcu.ordinal_position`,
  );
  const pks: Record<string, string[]> = {};
  for (const r of rows) (pks[r.table_name] ??= []).push(r.column_name);
  return pks;
}

async function scan(client: Client, options: Options): Promise<CellRepair[]> {
  const columns = await loadTextColumns(client, options.tables);
  const pks = await loadPrimaryKeys(client);
  const repairs: CellRepair[] = [];
  const skipped = new Set<string>();

  for (const { table_name: table, column_name: column } of columns) {
    const pk = pks[table];
    if (!pk) {
      skipped.add(table);
      continue;
    }
    // octet_length <> char_length is true exactly when the value has non-ASCII text
    const { rows } = await client.query(
      `SELECT ${pk.map(q).join(", ")}, ${q(column)} AS value
         FROM ${q(table)}
        WHERE octet_length(${q(column)}) <> char_length(${q(column)})`,
    );
    for (const row of rows) {
      const { value, levels } = repairDoubleEncodedUtf8(row.value);
      if (levels === 0) continue;
      const key: Record<string, unknown> = {};
      for (const p of pk) key[p] = row[p];
      repairs.push({
        table,
        column,
        key,
        before: row.value,
        after: value,
        levels,
      });
    }
  }

  for (const table of skipped) {
    console.warn(`  skipped ${table}: no primary key`);
  }
  return repairs;
}

function report(repairs: CellRepair[]) {
  const perColumn = new Map<
    string,
    { cells: number; multi: number; sample?: string }
  >();
  const perTable = new Map<string, Set<string>>();
  for (const r of repairs) {
    const col = `${r.table}.${r.column}`;
    const entry = perColumn.get(col) ?? { cells: 0, multi: 0 };
    entry.cells++;
    if (r.levels > 1) entry.multi++;
    entry.sample ??= `${JSON.stringify(r.before).slice(0, 50)} -> ${JSON.stringify(r.after).slice(0, 50)}`;
    perColumn.set(col, entry);
    (
      perTable.get(r.table) ?? perTable.set(r.table, new Set()).get(r.table)!
    ).add(JSON.stringify(r.key));
  }

  console.log("\n=== Double-encoded UTF-8 cells per column ===");
  for (const [col, e] of perColumn) {
    console.log(
      `  ${col}: ${e.cells} cells (${e.multi} multi-level)  e.g. ${e.sample}`,
    );
  }
  console.log("\n=== Rows to repair per table ===");
  for (const [table, keys] of perTable) console.log(`  ${table}: ${keys.size}`);
  console.log(`\nTotal: ${repairs.length} cells in ${perTable.size} tables`);
}

/**
 * Set each cell from `from` to `to` in one transaction. The UPDATE is guarded
 * on the expected current value, so cells changed in the meantime are skipped.
 */
async function writeCells(
  client: Client,
  cells: CellRepair[],
  direction: "repair" | "restore",
) {
  let updated = 0;
  let stale = 0;
  await client.query("BEGIN");
  try {
    for (const r of cells) {
      const [from, to] =
        direction === "repair" ? [r.before, r.after] : [r.after, r.before];
      const keyCols = Object.keys(r.key);
      const where = keyCols.map((c, i) => `${q(c)} = $${i + 3}`).join(" AND ");
      const result = await client.query(
        `UPDATE ${q(r.table)} SET ${q(r.column)} = $1
          WHERE ${q(r.column)} = $2 AND ${where}`,
        [to, from, ...keyCols.map((c) => r.key[c])],
      );
      if (result.rowCount === 1) updated++;
      else stale++;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
  console.log(
    `Updated ${updated} cells${stale ? `, ${stale} skipped (value changed since scan)` : ""}`,
  );
}

async function refreshMaterializedViews(client: Client) {
  const { rows: views } = await client.query<{ matviewname: string }>(
    `SELECT matviewname FROM pg_matviews WHERE schemaname = 'public'`,
  );
  for (const { matviewname } of views) {
    await client.query(`REFRESH MATERIALIZED VIEW ${q(matviewname)}`);
    console.log(`Refreshed materialized view ${matviewname}`);
  }
}

async function apply(client: Client, repairs: CellRepair[], options: Options) {
  fs.writeFileSync(options.rollbackFile, JSON.stringify(repairs, null, 1));
  console.log(`\nRollback data written to ${options.rollbackFile}`);
  await writeCells(client, repairs, "repair");
  await refreshMaterializedViews(client);
}

async function restore(client: Client, file: string) {
  const cells: CellRepair[] = JSON.parse(fs.readFileSync(file, "utf8"));
  console.log(`Restoring ${cells.length} cells from ${file}`);
  await writeCells(client, cells, "restore");
  await refreshMaterializedViews(client);
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  const client = createClient();
  await client.connect();
  console.log(
    `Connected to ${process.env.DATABASE_NAME} on ${process.env.DATABASE_HOST} (${options.restoreFile ? "RESTORE" : options.apply ? "APPLY" : "dry run"})`,
  );
  try {
    if (options.restoreFile) {
      await restore(client, options.restoreFile);
      return;
    }
    const repairs = await scan(client, options);
    report(repairs);
    if (!options.apply) {
      console.log("\nDry run: nothing written. Re-run with --apply to repair.");
    } else if (repairs.length === 0) {
      console.log("\nNothing to repair.");
    } else {
      await apply(client, repairs, options);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
