/**
 * e2e-delete-users.js
 *
 * Removes E2E test users from the staging database (cleanup step).
 * Run inside the backend pod via:
 *
 *   kubectl exec -n <ns> <pod> -i \
 *     -- node - < .github/workflows/scripts/e2e-delete-users.js
 *
 * No secret env vars needed for deletion — only uses the pod's existing
 * DATABASE_* env vars that are already present.
 */

'use strict';

const { Client } = require('pg');

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

  // Clean up fitters entry first (references credentials.user_id)
  const fitterResult = await client.query(
    'SELECT user_id FROM credentials WHERE user_name = $1',
    ['e2e-fitter@test.com'],
  );
  if (fitterResult.rows.length > 0) {
    await client.query('DELETE FROM fitters WHERE user_id = $1', [fitterResult.rows[0].user_id]);
    console.log('Deleted fitters entry for e2e-fitter');
  }

  const result = await client.query(
    'DELETE FROM credentials WHERE user_name IN ($1, $2)',
    ['e2e-admin@test.com', 'e2e-fitter@test.com'],
  );
  console.log('Deleted', result.rowCount, 'E2E test users');

  await client.end();
  process.exit(0);
})().catch((err) => {
  console.error('Failed to delete test users:', err.message);
  process.exit(1);
});
