import { MigrationInterface, QueryRunner } from "typeorm";

export class AddColumnGroupsToCustomOrderViews1774000000000
  implements MigrationInterface
{
  name = "AddColumnGroupsToCustomOrderViews1774000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE custom_order_views ADD COLUMN IF NOT EXISTS column_groups JSONB NOT NULL DEFAULT '[]'::jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE custom_order_views DROP COLUMN IF EXISTS column_groups`,
    );
  }
}
