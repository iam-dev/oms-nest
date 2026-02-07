import { MigrationInterface, QueryRunner } from "typeorm";
import { DROP_USER_VIEW, USER_VIEW_NULL_EMAIL } from "./user-view-sql";

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
    await queryRunner.query(DROP_USER_VIEW);

    // Increase password_hash from VARCHAR(40) to VARCHAR(60) for bcrypt
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(60)
    `);

    // Recreate the user view (NULL email at this point; next migration populates it)
    await queryRunner.query(USER_VIEW_NULL_EMAIL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USER_VIEW);

    // Revert to VARCHAR(40)
    // Note: This will fail if any existing hashes are longer than 40 chars
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(40)
    `);

    await queryRunner.query(USER_VIEW_NULL_EMAIL);
  }
}
