/**
 * Import MySQL data into PostgreSQL
 *
 * This script reads MySQL SQL files from mysql-legacy/data/ and converts them
 * to PostgreSQL format, then imports them into the database.
 *
 * Usage: npx ts-node scripts/import-mysql-data.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { parseInsertLine, toPgValue } from './lib/mysql-dump';

// Load environment variables
dotenv.config();

// Column name mapping: MySQL CamelCase -> PostgreSQL snake_case
const columnMappings: Record<string, Record<string, string>> = {
  UserTypes: {
    UserTypeID: 'id',
    TypeDescription: 'type_description',
  },
  Statuses: {
    ID: 'id',
    Name: 'name',
    FactoryHidden: 'factory_hidden',
    FactoryAlternativeName: 'factory_alternative_name',
    Sequence: 'sequence',
  },
  Brands: {
    ID: 'id',
    BrandName: 'brand_name',
  },
  LeatherTypes: {
    ID: 'id',
    Name: 'name',
    Sequence: 'sequence',
    Deleted: 'deleted',
  },
  Options: {
    ID: 'id',
    Name: 'name',
    Group: 'group',
    Price1: 'price1',
    Price2: 'price2',
    Price3: 'price3',
    Price4: 'price4',
    Price5: 'price5',
    Price6: 'price6',
    Price7: 'price7',
    PriceContrast1: 'price_contrast1',
    PriceContrast2: 'price_contrast2',
    PriceContrast3: 'price_contrast3',
    PriceContrast4: 'price_contrast4',
    PriceContrast5: 'price_contrast5',
    PriceContrast6: 'price_contrast6',
    PriceContrast7: 'price_contrast7',
    Sequence: 'sequence',
    Type: 'type',
    ExtraAllowed: 'extra_allowed',
    Deleted: 'deleted',
  },
  OptionsItems: {
    ID: 'id',
    OptionID: 'option_id',
    LeatherID: 'leather_id',
    Name: 'name',
    UserColor: 'user_color',
    UserLeather: 'user_leather',
    Price1: 'price1',
    Price2: 'price2',
    Price3: 'price3',
    Price4: 'price4',
    Price5: 'price5',
    Price6: 'price6',
    Price7: 'price7',
    Sequence: 'sequence',
    Deleted: 'deleted',
    Restrict: 'restrict',
  },
  Presets: {
    ID: 'id',
    Name: 'name',
    Sequence: 'sequence',
    Deleted: 'deleted',
  },
  PresetsItems: {
    OptionsID: 'options_id',
    ItemID: 'item_id',
    PresetID: 'preset_id',
  },
  Saddles: {
    ID: 'id',
    FactoryEU: 'factory_eu',
    FactoryGB: 'factory_gb',
    FactoryUS: 'factory_us',
    FactoryCA: 'factory_ca',
    FactoryAUD: 'factory_aud',
    FactoryDE: 'factory_de',
    FactoryNL: 'factory_nl',
    Brand: 'brand',
    ModelName: 'model_name',
    Presets: 'presets',
    Active: 'active',
    Type: 'type',
    Deleted: 'deleted',
    Sequence: 'sequence',
  },
  Factories: {
    ID: 'id',
    UserID: 'user_id',
    Deleted: 'deleted',
    Address: 'address',
    Zipcode: 'zipcode',
    State: 'state',
    City: 'city',
    Country: 'country',
    PhoneNo: 'phone_no',
    CellNo: 'cell_no',
    Currency: 'currency',
    Emailaddress: 'emailaddress',
  },
  FactoryEmployees: {
    ID: 'id',
    Deleted: 'deleted',
    Name: 'name',
    FactoryID: 'factory_id',
  },
  Fitters: {
    ID: 'id',
    UserID: 'user_id',
    Deleted: 'deleted',
    Address: 'address',
    Zipcode: 'zipcode',
    State: 'state',
    City: 'city',
    Country: 'country',
    PhoneNo: 'phone_no',
    CellNo: 'cell_no',
    Currency: 'currency',
    Emailaddress: 'emailaddress',
  },
  Customers: {
    ID: 'id',
    Deleted: 'deleted',
    FitterID: 'fitter_id',
    HorseName: 'horse_name',
    Name: 'name',
    Address: 'address',
    Company: 'company',
    City: 'city',
    Country: 'country',
    State: 'state',
    Zipcode: 'zipcode',
    Email: 'email',
    PhoneNo: 'phone_no',
    CellNo: 'cell_no',
    BankAccountNumber: 'bank_account_number',
  },
  Credentials: {
    UserID: 'user_id',
    Deleted: 'deleted',
    UserType: 'user_type',
    UserName: 'user_name',
    FullName: 'full_name',
    PasswordHash: 'password_hash',
    LastLogin: 'last_login',
    Blocked: 'blocked',
    PasswordResetHash: 'password_reset_hash',
    PasswordResetValidTo: 'password_reset_valid_to',
    Supervisor: 'supervisor',
  },
  Orders: {
    ID: 'id',
    FitterID: 'fitter_id',
    SaddleID: 'saddle_id',
    LeatherID: 'leather_id',
    FactoryID: 'factory_id',
    FitterStock: 'fitter_stock',
    CustomerID: 'customer_id',
    ShippedByEmployee: 'shipped_by_employee',
    FitterReference: 'fitter_reference',
    LastSeenFitter: 'last_seen_fitter',
    LastSeenCS: 'last_seen_cs',
    LastSeenFactory: 'last_seen_factory',
    HorseName: 'horse_name',
    Name: 'name',
    Address: 'address',
    Zipcode: 'zipcode',
    City: 'city',
    State: 'state',
    Country: 'country',
    PhoneNo: 'phone_no',
    CellNo: 'cell_no',
    Email: 'email',
    OrderStatus: 'order_status',
    ShipName: 'ship_name',
    ShipAddress: 'ship_address',
    ShipZipcode: 'ship_zipcode',
    ShipCity: 'ship_city',
    ShipState: 'ship_state',
    ShipCountry: 'ship_country',
    OrderTime: 'order_time',
    Payment: 'payment',
    PaymentTime: 'payment_time',
    OrderStep: 'order_step',
    PriceSaddle: 'price_saddle',
    PriceTradein: 'price_tradein',
    PriceDeposit: 'price_deposit',
    PriceDiscount: 'price_discount',
    PriceFittingeval: 'price_fittingeval',
    PriceCallfee: 'price_callfee',
    PriceGirth: 'price_girth',
    PriceShipping: 'price_shipping',
    PriceTax: 'price_tax',
    PriceAdditional: 'price_additional',
    SpecialNotes: 'special_notes',
    SerialNumber: 'serial_number',
    CustomOrder: 'custom_order',
    Changed: 'changed',
    Repair: 'repair',
    Demo: 'demo',
    Sponsored: 'sponsored',
    Rushed: 'rushed',
    OMSversion: 'oms_version',
    Currency: 'currency',
    OrderData: 'order_data',
    PriceAdditionalDescription: 'price_additional_description',
    StirrupLeathers: 'stirrup_leathers',
    Stirrups: 'stirrups',
    Girth: 'girth',
    SaddleComment: 'saddle_comment',
    CSComment: 'cs_comment',
    FactoryComment: 'factory_comment',
    CancelledReason: 'cancelled_reason',
    Deleted: 'deleted',
    Temp_Measurements: 'temp_measurements',
    Temp_Measurements2: 'temp_measurements2',
    Temp_SaddleOptions: 'temp_saddle_options',
    Temp_Measurements2FormData: 'temp_measurements2_form_data',
    Temp_OptionalServices: 'temp_optional_services',
    OrderSteps: 'order_steps',
  },
  SaddleLeathers: {
    ID: 'id',
    SaddleID: 'saddle_id',
    LeatherID: 'leather_id',
    Price1: 'price1',
    Price2: 'price2',
    Price3: 'price3',
    Price4: 'price4',
    Price5: 'price5',
    Price6: 'price6',
    Price7: 'price7',
    Sequence: 'sequence',
    Deleted: 'deleted',
  },
  SaddleOptionsItems: {
    ID: 'id',
    SaddleID: 'saddle_id',
    OptionID: 'option_id',
    OptionItemID: 'option_item_id',
    LeatherID: 'leather_id',
    Sequence: 'sequence',
    Deleted: 'deleted',
  },
  OrdersInfo: {
    OrderID: 'order_id',
    OptionID: 'option_id',
    OptionItemID: 'option_item_id',
    CloneNumber: 'clone_number',
    Color: 'color',
    Leathertype: 'leathertype',
    Custom: 'custom',
  },
  ClientConfirmation: {
    ID: 'id',
    UID: 'uid',
    CustomerID: 'customer_id',
    OrderID: 'order_id',
    Confirmed: 'confirmed',
    SendTime: 'send_time',
    ConfirmTime: 'confirm_time',
    Sign: 'sign',
  },
  Log: {
    ID: 'id',
    UserID: 'user_id',
    UserType: 'user_type',
    OnlyFor: 'only_for',
    OrderID: 'order_id',
    Text: 'text',
    Time: 'time',
    OrderStatusUpdatedFrom: 'order_status_updated_from',
    OrderStatusUpdatedTo: 'order_status_updated_to',
  },
  DBlog: {
    ID: 'id',
    Query: 'query',
    User: 'user',
    Timestamp: 'timestamp',
    Page: 'page',
    Backtrace: 'backtrace',
  },
};

// Table name mapping: MySQL -> PostgreSQL
const tableNameMapping: Record<string, string> = {
  UserTypes: 'user_types',
  Statuses: 'statuses',
  Brands: 'brands',
  LeatherTypes: 'leather_types',
  Options: 'options',
  OptionsItems: 'options_items',
  Presets: 'presets',
  PresetsItems: 'presets_items',
  Saddles: 'saddles',
  Factories: 'factories',
  FactoryEmployees: 'factory_employees',
  Fitters: 'fitters',
  Customers: 'customers',
  Credentials: 'credentials',
  Orders: 'orders',
  SaddleLeathers: 'saddle_leathers',
  SaddleOptionsItems: 'saddle_options_items',
  OrdersInfo: 'orders_info',
  ClientConfirmation: 'client_confirmation',
  Log: 'log',
  DBlog: 'dblog',
};

// Import order (respecting foreign key dependencies)
const importOrder = [
  // No dependencies
  { file: 'system-admin/user-types.sql', table: 'UserTypes' },
  { file: 'system-admin/statuses.sql', table: 'Statuses' },
  { file: 'product-catalog/brands.sql', table: 'Brands' },
  { file: 'product-catalog/leather-types.sql', table: 'LeatherTypes' },
  { file: 'product-catalog/options.sql', table: 'Options' },
  { file: 'product-catalog/presets.sql', table: 'Presets' },
  { file: 'core-business/factories.sql', table: 'Factories' },

  // Depends on above
  { file: 'product-catalog/options-items.sql', table: 'OptionsItems' },
  { file: 'product-catalog/presets-items.sql', table: 'PresetsItems' },
  { file: 'product-catalog/saddles.sql', table: 'Saddles' },
  { file: 'core-business/factory-employees.sql', table: 'FactoryEmployees' },
  { file: 'core-business/fitters.sql', table: 'Fitters' },
  { file: 'system-admin/credentials.sql', table: 'Credentials' },

  // Depends on fitters
  { file: 'core-business/customers.sql', table: 'Customers' },

  // Depends on customers, fitters, saddles
  { file: 'core-business/orders.sql', table: 'Orders' },

  // Relationship tables
  { file: 'relationships/saddle-leathers.sql', table: 'SaddleLeathers' },
  { file: 'relationships/saddle-options-items.sql', table: 'SaddleOptionsItems' },
  { file: 'relationships/orders-info.sql', table: 'OrdersInfo' },

  // Client confirmation (depends on orders, customers)
  { file: 'system-admin/client-confirmation.sql', table: 'ClientConfirmation' },

  // Audit tables (optional - large data)
  // { file: 'audit-logging/log.sql', table: 'Log' },
  // { file: 'audit-logging/dblog.sql', table: 'DBlog' },
];

const dataDir = path.join(
  __dirname,
  '../src/database/seeds/relational/production-data/mysql-legacy/data',
);

const BATCH_SIZE = 500;

interface ConvertedTable {
  pgTableName: string;
  columns: string[];
  /** One PostgreSQL VALUES tuple per source row, e.g. "(1, E'x', true)". */
  tuples: string[];
  repairedRows: number;
  skippedLines: number;
}

/**
 * Convert a `mysqldump --complete-insert --skip-extended-insert` file to
 * PostgreSQL tuples. Column names are mapped through columnMappings, MySQL
 * string escapes are kept via E'' syntax, tinyint 0/1 becomes true/false for
 * the given boolean columns, and double-encoded UTF-8 is repaired.
 */
function convertMySQLToPostgreSQL(
  sql: string,
  tableName: string,
  booleanColumns: Set<string>,
): ConvertedTable {
  const mapping = columnMappings[tableName];
  const pgTableName = tableNameMapping[tableName];
  if (!mapping || !pgTableName) {
    throw new Error(`No mapping found for table: ${tableName}`);
  }

  let columns: string[] | null = null;
  const tuples: string[] = [];
  let repairedRows = 0;
  let skippedLines = 0;

  for (const line of sql.split('\n')) {
    if (!line.startsWith('INSERT INTO')) continue;
    const parsed = parseInsertLine(line);
    if (!parsed) {
      skippedLines++;
      continue;
    }
    if (!columns) {
      columns = parsed.columns.map((col) => {
        const pgCol = mapping[col];
        if (!pgCol) {
          console.warn(`Warning: No mapping for column ${col} in table ${tableName}`);
          return col.toLowerCase();
        }
        return pgCol;
      });
    }
    let repaired = false;
    const values = parsed.values.map((token, i) => {
      const pg = toPgValue(token, booleanColumns.has(columns![i]));
      repaired ||= pg.repaired;
      return pg.sql;
    });
    if (repaired) repairedRows++;
    tuples.push(`(${values.join(', ')})`);
  }

  return { pgTableName, columns: columns ?? [], tuples, repairedRows, skippedLines };
}

async function loadBooleanColumns(client: Client, pgTableName: string): Promise<Set<string>> {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND data_type = 'boolean'`,
    [pgTableName],
  );
  return new Set(result.rows.map((r) => r.column_name as string));
}

/**
 * Insert tuples in batches; a failing batch is retried row by row so one bad
 * row costs only itself. Returns the number of rows that failed.
 */
async function insertTuples(client: Client, table: ConvertedTable): Promise<number> {
  const head = `INSERT INTO "${table.pgTableName}" (${table.columns.map((c) => `"${c}"`).join(', ')}) VALUES `;
  const tail = ' ON CONFLICT DO NOTHING';
  let failed = 0;
  for (let i = 0; i < table.tuples.length; i += BATCH_SIZE) {
    const batch = table.tuples.slice(i, i + BATCH_SIZE);
    try {
      await client.query(head + batch.join(',\n') + tail);
    } catch {
      for (const tuple of batch) {
        try {
          await client.query(head + tuple + tail);
        } catch (err) {
          failed++;
          if (failed <= 5) {
            console.error(`  Row failed in ${table.pgTableName}: ${(err as Error).message}\n    ${tuple.slice(0, 200)}`);
          }
        }
      }
    }
  }
  return failed;
}

async function importData() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'oms',
    user: process.env.DATABASE_USERNAME || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres',
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Disable triggers for faster import (not permitted on managed Postgres; import order respects FKs anyway)
    try {
      await client.query('SET session_replication_role = replica;');
    } catch {
      console.warn('Could not set session_replication_role (no superuser); continuing');
    }

    for (const item of importOrder) {
      const filePath = path.join(dataDir, item.file);

      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        continue;
      }

      console.log(`\nImporting ${item.table} from ${item.file}...`);

      const pgTableName = tableNameMapping[item.table];
      const booleanColumns = await loadBooleanColumns(client, pgTableName);
      const mysqlSql = fs.readFileSync(filePath, 'utf-8');
      const table = convertMySQLToPostgreSQL(mysqlSql, item.table, booleanColumns);

      if (table.tuples.length === 0) {
        console.log(`  No data found in ${item.file}`);
        continue;
      }
      if (table.skippedLines > 0) {
        console.warn(`  Could not parse ${table.skippedLines} INSERT lines in ${item.file}`);
      }
      if (table.repairedRows > 0) {
        console.log(`  Repaired double-encoded UTF-8 in ${table.repairedRows} rows`);
      }
      const failed = await insertTuples(client, table);
      const result = await client.query(`SELECT COUNT(*) FROM "${pgTableName}"`);
      console.log(
        `  Imported ${result.rows[0].count} records into ${pgTableName} (${table.tuples.length} in file${failed ? `, ${failed} rows FAILED` : ''})`,
      );
    }

    // Re-enable triggers
    try {
      await client.query('SET session_replication_role = DEFAULT;');
    } catch {
      /* see above */
    }

    // Update sequences to continue from max ID
    console.log('\nUpdating sequences...');
    const tables = [
      'user_types',
      'statuses',
      'brands',
      'leather_types',
      'options',
      'options_items',
      'presets',
      'saddles',
      'factories',
      'factory_employees',
      'fitters',
      'customers',
      'credentials',
      'orders',
      'saddle_leathers',
      'saddle_options_items',
      'client_confirmation',
      'log',
      'dblog',
    ];

    for (const table of tables) {
      try {
        await client.query(`
          SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, false)
        `);
      } catch (err) {
        // Some tables might not have id column or sequence
      }
    }

    // Special case for credentials (user_id instead of id)
    await client.query(`
      SELECT setval(pg_get_serial_sequence('"credentials"', 'user_id'), COALESCE((SELECT MAX(user_id) FROM "credentials"), 0) + 1, false)
    `);

    console.log('\nImport completed!');

    // Print summary
    console.log('\n=== Import Summary ===');
    for (const item of importOrder) {
      try {
        const result = await client.query(
          `SELECT COUNT(*) FROM "${tableNameMapping[item.table]}"`,
        );
        console.log(`${item.table}: ${result.rows[0].count} records`);
      } catch (err) {
        console.log(`${item.table}: Error getting count`);
      }
    }
  } catch (err) {
    console.error('Error:', err);
    throw err;
  } finally {
    await client.end();
  }
}

importData().catch(console.error);
