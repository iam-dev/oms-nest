import { NestFactory } from "@nestjs/core";
import { SeedModule } from "./seed.module";
import { UserSeedService } from "./user/user-seed.service";
import { BrandSeedService } from "./brand/brand-seed.service";
import { LeathertypeSeedService } from "./leathertype/leathertype-seed.service";
import { FactorySeedService } from "./factory/factory-seed.service";
import { FitterSeedService } from "./fitter/fitter-seed.service";
import { SaddleSeedService } from "./saddle/saddle-seed.service";
import { CustomerSeedService } from "./customer/customer-seed.service";
import { OrderSeedService } from "./order/order-seed.service";

/**
 * Run Seed
 *
 * This script initializes the database seeding process.
 *
 * For CI/development: Creates test data for E2E testing.
 * For production: Use SQL scripts in production-data/postgres/scripts/.
 *
 * Usage:
 *   npm run seed:run:relational
 *
 * Seed order (respects foreign key dependencies):
 *   1. Users (credentials table - FK target for factories/fitters)
 *   2. Brands
 *   3. Leather types
 *   4. Factories (depends on users)
 *   5. Fitters (depends on users)
 *   6. Saddles (depends on factories)
 *   7. Customers (depends on fitters)
 *   8. Orders (depends on fitters, factories, customers, saddles)
 */
const runSeed = async () => {
  const app = await NestFactory.create(SeedModule);

  console.log("🌱 Running database seeds...\n");

  // 1. Users (must be first - FK target for factories and fitters)
  await app.get(UserSeedService).run();

  // 2. Brands
  await app.get(BrandSeedService).run();

  // 3. Leather types
  await app.get(LeathertypeSeedService).run();

  // 4. Factories (depends on users)
  await app.get(FactorySeedService).run();

  // 5. Fitters (depends on users)
  await app.get(FitterSeedService).run();

  // 6. Saddles (depends on factories)
  await app.get(SaddleSeedService).run();

  // 7. Customers (depends on fitters)
  await app.get(CustomerSeedService).run();

  // 8. Orders (depends on fitters, factories, customers, saddles)
  await app.get(OrderSeedService).run();

  console.log("\n✅ All seeds completed successfully!");

  await app.close();
};

void runSeed();
