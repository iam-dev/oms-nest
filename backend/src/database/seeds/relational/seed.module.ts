import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";

import { DataSource, DataSourceOptions } from "typeorm";
import { TypeOrmConfigService } from "../../typeorm-config.service";
import databaseConfig from "../../config/database.config";
import appConfig from "../../../config/app.config";
import { UserSeedModule } from "./user/user-seed.module";

/**
 * Seed Module
 *
 * This module is used for database seeding.
 *
 * For development/CI, this creates test users via UserSeedModule.
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
  ],
})
export class SeedModule {}
