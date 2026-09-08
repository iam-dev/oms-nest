/**
 * e2e-create-users.js
 *
 * Creates E2E test users in the staging database.
 * `kubectl exec` has no --env flag; env vars are injected by prepending
 * `process.env.X = "…"` assignments to the piped script. Invoked via:
 *
 *   {
 *     node -e 'const q = s => JSON.stringify(s); process.stdout.write(
 *       "process.env.E2E_ADMIN_PASSWORD=" + q(process.env.E2E_ADMIN_PASSWORD) + ";\n" +
 *       "process.env.E2E_FITTER_PASSWORD=" + q(process.env.E2E_FITTER_PASSWORD) + ";\n"
 *     );'
 *     cat .github/workflows/scripts/e2e-create-users.js
 *   } | kubectl exec -n <ns> <pod> -i -- node -
 *
 * Passwords traverse only stdin and process.env — never argv on the runner
 * or inside the pod — so they do not appear in the process command line
 * (proc/<pid>/cmdline) anywhere.
 *
 * NOTE: do not write that proc path with a star wildcard here. The
 * star-slash sequence would terminate this block comment early and turn
 * the rest of the prose into code, breaking the entire script.
 */

'use strict';

const bcrypt = require('bcryptjs');
const { Client } = require('pg');

const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const fitterPassword = process.env.E2E_FITTER_PASSWORD;

if (!adminPassword || !fitterPassword) {
  console.error('E2E_ADMIN_PASSWORD and E2E_FITTER_PASSWORD must be set');
  process.exit(1);
}

const client = new Client({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  ssl: { rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === 'true' },
});

(async () => {
  await client.connect();

  const adminHash = await bcrypt.hash(adminPassword, 10);
  const fitterHash = await bcrypt.hash(fitterPassword, 10);

  // Use empty string literal directly (no \\'\\'  shell escaping needed)
  const upsertSql =
    'INSERT INTO credentials ' +
    '(user_name, password_hash, full_name, user_type, last_login, password_reset_hash, blocked, deleted) ' +
    'VALUES ($1, $2, $3, $4, 0, $5, 0, 0) ' +
    'ON CONFLICT (user_name) DO UPDATE SET password_hash = EXCLUDED.password_hash, blocked = 0, deleted = 0';

  await client.query(upsertSql, ['e2e-admin@test.com', adminHash, 'E2E Admin', 2, '']);
  await client.query(upsertSql, ['e2e-fitter@test.com', fitterHash, 'E2E Fitter', 1, '']);

  // Ensure fitters table entry exists so getUserRole() resolves user_type=1 correctly
  const fitterResult = await client.query(
    'SELECT user_id FROM credentials WHERE user_name = $1',
    ['e2e-fitter@test.com'],
  );
  const fitterUserId = fitterResult.rows[0].user_id;

  await client.query(
    'INSERT INTO fitters (user_id, deleted, address, zipcode, state, city, country, phone_no, cell_no, currency, emailaddress) ' +
    'VALUES ($1, 0, $2, $2, $2, $2, $2, $2, $2, 1, $3) ON CONFLICT DO NOTHING',
    [fitterUserId, '', 'e2e-fitter@test.com'],
  );

  await client.end();
  console.log('E2E test users created/updated with random passwords (including fitters entry)');
  process.exit(0);
})().catch((err) => {
  console.error('Failed to create test users:', err.message);
  process.exit(1);
});
