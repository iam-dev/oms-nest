import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomOrderCellOverridesTable1772100000000
  implements MigrationInterface
{
  name = "CreateCustomOrderCellOverridesTable1772100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_order_cell_overrides" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "order_id" INTEGER NOT NULL,
        "column_key" VARCHAR(255) NOT NULL,
        "override_value" TEXT NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_cell_override_user_order_column" UNIQUE ("user_id", "order_id", "column_key")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cell_overrides_user_id" ON "custom_order_cell_overrides" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_cell_overrides_order_id" ON "custom_order_cell_overrides" ("order_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "custom_order_cell_overrides"`,
    );
  }
}
