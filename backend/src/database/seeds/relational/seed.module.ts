import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DataSource, DataSourceOptions } from "typeorm";
import { TypeOrmConfigService } from "../../typeorm-config.service";
import databaseConfig from "../../config/database.config";
import appConfig from "../../../config/app.config";
import { UserSeedModule } from "./user/user-seed.module";
import { BrandSeedModule } from "./brand/brand-seed.module";
import { LeathertypeSeedModule } from "./leathertype/leathertype-seed.module";
import { FactorySeedModule } from "./factory/factory-seed.module";
import { FitterSeedModule } from "./fitter/fitter-seed.module";
import { SaddleSeedModule } from "./saddle/saddle-seed.module";
import { CustomerSeedModule } from "./customer/customer-seed.module";
import { OrderSeedModule } from "./order/order-seed.module";

/**
 * Seed Module
 *
 * This module is used for database seeding.
 *
 * For development/CI, this creates test data via seed modules.
 * For production data, use SQL scripts in production-data/postgres/scripts/.
 * See the README.md file in production-data/ for instructions.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: [".env"],
    }),
    TypeOrmModule.forRootAsync({
      useClass: TypeOrmConfigService,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
    UserSeedModule,
    BrandSeedModule,
    LeathertypeSeedModule,
    FactorySeedModule,
    FitterSeedModule,
    SaddleSeedModule,
    CustomerSeedModule,
    OrderSeedModule,
  ],
})
export class SeedModule {}
