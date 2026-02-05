import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import bcrypt from "bcryptjs";
import { UserEntity } from "../../../../users/infrastructure/persistence/relational/entities/user.entity";

/**
 * Test users that match the E2E test expectations.
 * These users are created for CI/CD testing environments.
 */
const TEST_USERS = [
  {
    username: "admin@omsaddle.com",
    email: "admin@omsaddle.com",
    password: "AdminPass123!",
    name: "Test Admin",
    currency: "EUR",
    userType: 2, // admin
    isSupervisor: 1,
  },
  {
    username: "sarah.thompson@fitters.com",
    email: "sarah.thompson@fitters.com",
    password: "FitterPass123!",
    name: "Sarah Thompson",
    currency: "EUR",
    userType: 1, // fitter
    isSupervisor: 0,
  },
  {
    username: "testuser",
    email: "testuser@omsaddle.com",
    password: "TestUser123!",
    name: "Test User",
    currency: "EUR",
    userType: 6, // regular user
    isSupervisor: 0,
  },
];

@Injectable()
export class UserSeedService {
  private readonly logger = new Logger(UserSeedService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  async run(): Promise<void> {
    this.logger.log("🌱 Starting user seed...");

    for (const userData of TEST_USERS) {
      // Check if user already exists
      const existingUser = await this.userRepository.findOne({
        where: [{ email: userData.email }, { username: userData.username }],
      });

      if (existingUser) {
        this.logger.log(
          `User ${userData.username} already exists, skipping...`,
        );
        continue;
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create the user
      const user = this.userRepository.create({
        username: userData.username,
        email: userData.email,
        password: hashedPassword,
        name: userData.name,
        currency: userData.currency,
        userType: userData.userType,
        isSupervisor: userData.isSupervisor,
        enabled: true,
      });

      await this.userRepository.save(user);
      this.logger.log(`✅ Created user: ${userData.username}`);
    }

    this.logger.log("🌱 User seed completed!");
  }
}
