// TODO(security/BE-022): This migration is in a half-normalized state.
//
// Problems to address before a production run:
//   1. Pre-flight audit: run `SELECT DISTINCT country FROM fitters` and confirm
//      that the complete ISO → full-name mapping table covers ALL values in the DB.
//      If any ISO code is missing here it will be left as-is, causing silent data
//      inconsistency.
//   2. Expand the mapping to a full ISO 3166-1 alpha-2 table, not just NL and US.
//   3. The `down()` method is a no-op ("Not reversible") because it doesn't back up
//      originals.  Rewrite `up()` to save originals into a backup column or table
//      first, then `down()` can restore from it.
//
// Do NOT run this migration against production without those three steps completed.
import { MigrationInterface, QueryRunner } from "typeorm";

export class NormalizeFitterCountries1774200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Fix ISO codes and invalid values to full country names
    await queryRunner.query(
      `UPDATE fitters SET country = 'Netherlands' WHERE country = 'NL'`,
    );
    await queryRunner.query(
      `UPDATE fitters SET country = 'United States' WHERE country = 'US'`,
    );
    await queryRunner.query(
      `UPDATE fitters SET country = '' WHERE country = '-1'`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Not reversible - original values were inconsistent data
  }
}
