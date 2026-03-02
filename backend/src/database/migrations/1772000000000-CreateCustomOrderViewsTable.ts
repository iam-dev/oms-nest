import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCustomOrderViewsTable1772000000000
  implements MigrationInterface
{
  name = "CreateCustomOrderViewsTable1772000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_order_views" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "columns" JSONB NOT NULL DEFAULT '[]',
        "is_default" BOOLEAN NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_custom_order_views_user_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_custom_order_views_user_id" ON "custom_order_views" ("user_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_custom_order_views_is_default" ON "custom_order_views" ("is_default")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_order_views"`);
  }
}
