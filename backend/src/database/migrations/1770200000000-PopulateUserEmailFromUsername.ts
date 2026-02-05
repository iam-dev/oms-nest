import { MigrationInterface, QueryRunner } from "typeorm";
import {
  DROP_USER_VIEW,
  USER_VIEW_WITH_EMAIL,
  USER_VIEW_NULL_EMAIL,
} from "./user-view-sql";

/**
 * Populate email field in user view from user_name
 *
 * The user_name column in credentials table contains email addresses
 * (e.g., 'admin@omsaddle.com'). The user view was incorrectly mapping
 * this to NULL for the email column.
 *
 * This migration updates the view to populate email from user_name,
 * fixing E2E tests that expect loginData.user.email to be populated.
 */
export class PopulateUserEmailFromUsername1770200000000
  implements MigrationInterface
{
  name = "PopulateUserEmailFromUsername1770200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USER_VIEW);
    await queryRunner.query(USER_VIEW_WITH_EMAIL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(DROP_USER_VIEW);
    await queryRunner.query(USER_VIEW_NULL_EMAIL);
  }
}
