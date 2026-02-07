import { Module } from "@nestjs/common";
import { UserSeedService } from "./user-seed.service";

/**
 * User Seed Module
 *
 * Seeds test users into the credentials table for CI/E2E testing.
 * Note: Uses DataSource directly since "user" is a VIEW over "credentials".
 */
@Module({
  providers: [UserSeedService],
  exports: [UserSeedService],
})
export class UserSeedModule {}
