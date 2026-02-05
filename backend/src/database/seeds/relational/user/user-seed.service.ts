import { Injectable, Logger } from "@nestjs/common";
import { DataSource } from "typeorm";
import bcrypt from "bcryptjs";

/**
 * Test users that match the E2E test expectations.
 * These users are created for CI/CD testing environments.
 *
 * Note: The "user" entity is a VIEW over the "credentials" table.
 * We must insert directly into "credentials" to create users.
 */
const TEST_USERS = [
  {
    username: "admin@omsaddle.com",
    password: "AdminPass123!",
    name: "Test Admin",
  },
  {
    username: "sarah.thompson@fitters.com",
    password: "FitterPass123!",
    name: "Sarah Thompson",
  },
  {
    username: "testuser",
    password: "TestUser123!",
    name: "Test User",
  },
];

@Injectable()
export class UserSeedService {
  private readonly logger = new Logger(UserSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    this.logger.log("🌱 Starting user seed...");

    for (const userData of TEST_USERS) {
      // Check if user already exists in credentials table
      const existingUser = await this.dataSource.query(
        `SELECT user_id FROM credentials WHERE user_name = $1 LIMIT 1`,
        [userData.username],
      );

      if (existingUser.length > 0) {
        this.logger.log(
          `User ${userData.username} already exists, skipping...`,
        );
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Insert directly into credentials table
      // The "user" view will automatically reflect this data
      await this.dataSource.query(
        `INSERT INTO credentials (user_name, password_hash, full_name, blocked, deleted)
         VALUES ($1, $2, $3, 0, 0)`,
        [userData.username, hashedPassword, userData.name],
      );

      this.logger.log(`✅ Created user: ${userData.username}`);
    }

    this.logger.log("🌱 User seed completed!");
  }
}
