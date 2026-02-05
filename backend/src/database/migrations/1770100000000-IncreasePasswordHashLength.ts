import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Increase password_hash column length to accommodate bcrypt hashes
 *
 * Bcrypt hashes are 60 characters long, but the original schema
 * defined password_hash as VARCHAR(40) (matching the old MySQL SHA1 hashes).
 */
export class IncreasePasswordHashLength1770100000000
  implements MigrationInterface
{
  name = "IncreasePasswordHashLength1770100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Increase password_hash from VARCHAR(40) to VARCHAR(60) for bcrypt
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(60)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to VARCHAR(40)
    // Note: This will fail if any existing hashes are longer than 40 chars
    await queryRunner.query(`
      ALTER TABLE "credentials"
      ALTER COLUMN "password_hash" TYPE VARCHAR(40)
    `);
  }
}
