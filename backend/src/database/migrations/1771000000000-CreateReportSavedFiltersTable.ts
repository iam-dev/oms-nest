import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateReportSavedFiltersTable1771000000000
  implements MigrationInterface
{
  name = "CreateReportSavedFiltersTable1771000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_saved_filters" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "filters" JSONB NOT NULL DEFAULT '{}',
        "is_default" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_report_saved_filters_user_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_saved_filters_user_id" ON "report_saved_filters" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_report_saved_filters_is_default" ON "report_saved_filters" ("is_default")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "report_saved_filters"`);
  }
}
