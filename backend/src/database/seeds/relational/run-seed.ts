import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed.module";
import { UserSeedService } from "./user/user-seed.service";

/**
 * Run Seed
 *
 * This script initializes the database seeding process.
 *
 * For CI/development: Creates test users for E2E testing.
 * For production: Use SQL scripts in production-data/postgres/scripts/.
 *
 * Usage:
 *   npm run seed:run:relational
 *
 * For production data:
 * 1. Start the PostgreSQL container: ./production-data/postgres/scripts/setup-postgres.sh
 * 2. Transform MySQL data (first time): ./production-data/postgres/scripts/transform-mysql-to-postgres.sh
 * 3. Import all data: ./production-data/postgres/scripts/import-data.sh
 * 4. Validate the import: ./production-data/postgres/scripts/validate-data.sh
 *
 * See the README.md file in production-data/ for detailed instructions.
 */
const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  console.log("🌱 Running database seeds...\n");

  // Run user seeds (for CI/E2E testing)
  const userSeedService = app.get(UserSeedService);
  await userSeedService.run();

  console.log("\n✅ All seeds completed successfully!");
  console.log("\n📋 For production data, use the SQL scripts:");
  console.log(
    "   cd src/database/seeds/relational/production-data/postgres/scripts",
  );
  console.log("   ./setup-postgres.sh      # Start PostgreSQL container");
  console.log(
    "   ./transform-mysql-to-postgres.sh  # Transform data (first time)",
  );
  console.log("   ./import-data.sh         # Import all schema and data");
  console.log("   ./validate-data.sh       # Validate the import");
  console.log("\n📊 See production-data/README.md for full documentation.\n");

  await app.close();
};

void runSeed();
