import { MigrationInterface, QueryRunner } from "typeorm";

export class RevertRookSaddleTypeToMatchLegacy1770500000000
  implements MigrationInterface
{
  name = "RevertRookSaddleTypeToMatchLegacy1770500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // The previous migration (1770400000000) changed Rook 2.5 (K643C) from type=0 to type=1
    // based on a wrong assumption that 0=Jumping, 1=Dressage.
    // The legacy PHP system actually maps: 0=Dressage, 1=Jumping.
    // So Rook 2.5 was originally correct at type=0 (Dressage).
    // Revert it back to type=0 to match production.
    await queryRunner.query(`UPDATE saddles SET type = 0 WHERE id = 101`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE saddles SET type = 1 WHERE id = 101`);
  }
}
