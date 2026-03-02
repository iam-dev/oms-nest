import { MigrationInterface, QueryRunner } from "typeorm";

export class AddViewGroupsAndTabSupport1773000000000
  implements MigrationInterface
{
  name = "AddViewGroupsAndTabSupport1773000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create custom_order_view_groups table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_order_view_groups" (
        "id" SERIAL PRIMARY KEY,
        "user_id" INTEGER NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "uq_custom_order_view_groups_user_name" UNIQUE ("user_id", "name")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_custom_order_view_groups_user_id" ON "custom_order_view_groups" ("user_id")`,
    );

    // 2. Add group_id and tab_order columns to custom_order_views
    await queryRunner.query(
      `ALTER TABLE "custom_order_views" ADD COLUMN IF NOT EXISTS "group_id" INTEGER NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "custom_order_views" ADD COLUMN IF NOT EXISTS "tab_order" INTEGER NOT NULL DEFAULT 0`,
    );

    // 3. Add foreign key constraint
    await queryRunner.query(
      `ALTER TABLE "custom_order_views" ADD CONSTRAINT "fk_custom_order_views_group_id" FOREIGN KEY ("group_id") REFERENCES "custom_order_view_groups"("id") ON DELETE CASCADE`,
    );

    // 4. Drop old unique constraint
    await queryRunner.query(
      `ALTER TABLE "custom_order_views" DROP CONSTRAINT IF EXISTS "uq_custom_order_views_user_name"`,
    );

    // 5. Add new unique constraint (names unique within group+user, using COALESCE for NULL group_id)
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_custom_order_views_user_group_name" ON "custom_order_views" ("user_id", COALESCE("group_id", 0), "name")`,
    );

    // 6. Add index on group_id for faster lookups
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_custom_order_views_group_id" ON "custom_order_views" ("group_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse in opposite order
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_custom_order_views_group_id"`,
    );

    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_custom_order_views_user_group_name"`,
    );

    // Restore old unique constraint
    await queryRunner.query(
      `ALTER TABLE "custom_order_views" ADD CONSTRAINT "uq_custom_order_views_user_name" UNIQUE ("user_id", "name")`,
    );

    await queryRunner.query(
      `ALTER TABLE "custom_order_views" DROP CONSTRAINT IF EXISTS "fk_custom_order_views_group_id"`,
    );

    await queryRunner.query(
      `ALTER TABLE "custom_order_views" DROP COLUMN IF EXISTS "tab_order"`,
    );

    await queryRunner.query(
      `ALTER TABLE "custom_order_views" DROP COLUMN IF EXISTS "group_id"`,
    );

    await queryRunner.query(`DROP TABLE IF EXISTS "custom_order_view_groups"`);
  }
}
