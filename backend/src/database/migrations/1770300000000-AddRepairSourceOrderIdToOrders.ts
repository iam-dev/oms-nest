import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRepairSourceOrderIdToOrders1770300000000
  implements MigrationInterface
{
  name = "AddRepairSourceOrderIdToOrders1770300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add column to track which original order a repair was created from
    await queryRunner.query(`
      ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS repair_source_order_id INTEGER DEFAULT NULL
    `);

    // Add partial index for efficient lookups (only index non-null values)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_repair_source
      ON orders(repair_source_order_id)
      WHERE repair_source_order_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_orders_repair_source`);
    await queryRunner.query(
      `ALTER TABLE orders DROP COLUMN IF EXISTS repair_source_order_id`,
    );
  }
}
