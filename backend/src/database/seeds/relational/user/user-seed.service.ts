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
    userType: 2, // ADMIN
  },
  {
    username: "sarah.thompson@fitters.com",
    password: "FitterPass123!",
    name: "Sarah Thompson",
    userType: 1, // FITTER
  },
  {
    username: "testuser",
    password: "TestUser123!",
    name: "Test User",
    userType: 6, // USER
  },
];

/**
 * FK placeholder users required by factory and fitter seed data.
 * These are inserted with explicit user_ids so foreign keys resolve correctly.
 */
const FK_USERS = [
  {
    userId: 15,
    username: "factory-us@test.com",
    userType: 3,
    name: "US Factory User",
  },
  {
    userId: 20,
    username: "factory-gb@test.com",
    userType: 3,
    name: "GB Factory User",
  },
  {
    userId: 21,
    username: "factory-eu@test.com",
    userType: 3,
    name: "EU Factory User",
  },
  {
    userId: 22,
    username: "factory-ca@test.com",
    userType: 3,
    name: "CA Factory User",
  },
  {
    userId: 24,
    username: "fitter-nl@test.com",
    userType: 1,
    name: "NL Fitter User",
  },
  {
    userId: 28,
    username: "fitter-gb@test.com",
    userType: 1,
    name: "GB Fitter User",
  },
  {
    userId: 29,
    username: "fitter-us@test.com",
    userType: 1,
    name: "US Fitter User",
  },
  {
    userId: 30,
    username: "fitter-ca@test.com",
    userType: 1,
    name: "CA Fitter User",
  },
  {
    userId: 31,
    username: "fitter-au@test.com",
    userType: 1,
    name: "AU Fitter User",
  },
];

@Injectable()
export class UserSeedService {
  private readonly logger = new Logger(UserSeedService.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv === "production") {
      this.logger.warn("Refusing to seed test users in production environment");
      return;
    }

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
      // Include all NOT NULL columns: user_type, last_login, password_reset_hash
      await this.dataSource.query(
        `INSERT INTO credentials (user_name, password_hash, full_name, user_type, last_login, password_reset_hash, blocked, deleted)
         VALUES ($1, $2, $3, $4, 0, '', 0, 0)`,
        [userData.username, hashedPassword, userData.name, userData.userType],
      );

      this.logger.log(`✅ Created user: ${userData.username}`);
    }

    // Insert FK placeholder users with explicit user_ids
    const defaultPassword = await bcrypt.hash("FkUser123!", 10);
    for (const fkUser of FK_USERS) {
      await this.dataSource.query(
        `INSERT INTO credentials (user_id, user_name, password_hash, full_name, user_type, last_login, password_reset_hash, blocked, deleted)
         VALUES ($1, $2, $3, $4, $5, 0, '', 0, 0)
         ON CONFLICT (user_id) DO NOTHING`,
        [
          fkUser.userId,
          fkUser.username,
          defaultPassword,
          fkUser.name,
          fkUser.userType,
        ],
      );
      this.logger.log(
        `✅ Ensured FK user: ${fkUser.username} (id=${fkUser.userId})`,
      );
    }

    this.logger.log("🌱 User seed completed!");
  }
}
