import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Increase password_hash column length to accommodate bcrypt hashes
 *
 * Bcrypt hashes are 60 characters long, but the original schema
 * defined password_hash as VARCHAR(40) (matching the old MySQL SHA1 hashes).
 *
 * The "user" view depends on this column, so we must drop and recreate it.
 */
export class IncreasePasswordHashLength1770100000000
  implements MigrationInterface
{
  name = "IncreasePasswordHashLength1770100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the user view that depends on password_hash
    await queryRunner.query(`DROP VIEW IF EXISTS "user"`);

    // Increase password_hash from VARCHAR(40) to VARCHAR(60) for bcrypt
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(60)
    `);

    // Recreate the user view (from AddUserTypeToUserView1738200000000)
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop the user view
    await queryRunner.query(`DROP VIEW IF EXISTS "user"`);

    // Revert to VARCHAR(40)
    // Note: This will fail if any existing hashes are longer than 40 chars
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(40)
    `);

    // Recreate the user view
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
  }
}
