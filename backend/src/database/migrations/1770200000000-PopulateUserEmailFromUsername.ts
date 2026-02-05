import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Populate email field in user view from user_name
 *
 * The user_name column in credentials table contains email addresses
 * (e.g., 'admin@omsaddle.com'). The user view was incorrectly mapping
 * this to NULL for the email column.
 *
 * This migration updates the view to populate email from user_name,
 * fixing E2E tests that expect loginData.user.email to be populated.
 */
export class PopulateUserEmailFromUsername1770200000000
  implements MigrationInterface
{
  name = "PopulateUserEmailFromUsername1770200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the user view
    await queryRunner.query(`DROP VIEW IF EXISTS "user"`);

    // Recreate the user view with email populated from user_name
    await queryRunner.query(`
      CREATE VIEW "user" AS
      SELECT
        uuid_generate_v5(uuid_ns_oid(), user_id::text) AS id,
        user_id AS legacy_id,
        last_login,
        user_name AS username,
        password_hash AS password,
        password_reset_hash AS reset_token,
        password_reset_valid_to AS reset_token_expires_at,
        (blocked = 0) AS enabled,
        user_name AS email,
        NULL::varchar AS address,
        NULL::varchar AS city,
        NULL::varchar AS zipcode,
        NULL::varchar AS state,
        NULL::varchar AS cell_no,
        NULL::varchar AS phone_no,
        NULL::varchar AS country,
        'USD'::varchar AS currency,
        full_name AS name,
        user_type,
        supervisor AS is_supervisor,
        CURRENT_TIMESTAMP AS created_at,
        CURRENT_TIMESTAMP AS updated_at,
        CASE WHEN deleted = 1 THEN CURRENT_TIMESTAMP ELSE NULL END AS deleted_at
      FROM credentials
    `);

    console.log("✅ User view updated: email now populated from user_name");
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the user view
    await queryRunner.query(`DROP VIEW IF EXISTS "user"`);

    // Recreate the user view with NULL email (previous behavior)
    await queryRunner.query(`
      CREATE VIEW "user" AS
      SELECT
        uuid_generate_v5(uuid_ns_oid(), user_id::text) AS id,
        user_id AS legacy_id,
        last_login,
        user_name AS username,
        password_hash AS password,
        password_reset_hash AS reset_token,
        password_reset_valid_to AS reset_token_expires_at,
        (blocked = 0) AS enabled,
        NULL::varchar AS email,
        NULL::varchar AS address,
        NULL::varchar AS city,
        NULL::varchar AS zipcode,
        NULL::varchar AS state,
        NULL::varchar AS cell_no,
        NULL::varchar AS phone_no,
        NULL::varchar AS country,
        'USD'::varchar AS currency,
        full_name AS name,
        user_type,
        supervisor AS is_supervisor,
        CURRENT_TIMESTAMP AS created_at,
        CURRENT_TIMESTAMP AS updated_at,
        CASE WHEN deleted = 1 THEN CURRENT_TIMESTAMP ELSE NULL END AS deleted_at
      FROM credentials
    `);

    console.log("✅ User view reverted: email back to NULL");
  }
}
