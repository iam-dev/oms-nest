import { MigrationInterface, QueryRunner } from "typeorm";

export class FixCloneNumberDefaultAndRookSaddleType1770400000000
  implements MigrationInterface
{
  name = "FixCloneNumberDefaultAndRookSaddleType1770400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Bug 4: Add DEFAULT 0 to orders_info.clone_number to prevent null constraint errors
    await queryRunner.query(
      `ALTER TABLE orders_info ALTER COLUMN clone_number SET DEFAULT 0`,
    );

    // Bug 7: Fix Rook 2.5 (K643C) saddle type from 0 (Jumping) to 1 (Dressage)
    await queryRunner.query(`UPDATE saddles SET type = 1 WHERE id = 101`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert clone_number default
    await queryRunner.query(
      `ALTER TABLE orders_info ALTER COLUMN clone_number DROP DEFAULT`,
    );

    // Revert Rook 2.5 saddle type back to Jumping
    await queryRunner.query(`UPDATE saddles SET type = 0 WHERE id = 101`);
  }
}
