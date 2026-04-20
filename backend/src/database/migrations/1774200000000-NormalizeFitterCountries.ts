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
