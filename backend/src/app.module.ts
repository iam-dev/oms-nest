import { Module } from "@nestjs/common";
import { UsersModule } from "./users/users.module";
import { FilesModule } from "./files/files.module";
import { AuthModule } from "./auth/auth.module";
import databaseConfig from "./database/config/database.config";
import authConfig from "./auth/config/auth.config";
import appConfig from "./config/app.config";
import cacheConfig from "./config/cache.config";
import mailConfig from "./mail/config/mail.config";
import fileConfig from "./files/config/file.config";
import redisConfig from "./config/redis.config";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmConfigService } from "./database/typeorm-config.service";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { MailModule } from "./mail/mail.module";
import { HomeModule } from "./home/home.module";
import { DataSource, DataSourceOptions } from "typeorm";
// AllConfigType imported but not used directly - type is inferred
import { SessionModule } from "./session/session.module";
import { MailerModule } from "./mailer/mailer.module";
import { HealthModule } from "./health/health.module";
import { MonitoringModule } from "./monitoring/monitoring.module";
import { BehaviorsModule } from "./behaviors/behaviors.module";
import { CustomerModule } from "./customers/customer.module";
import { FitterModule } from "./fitters/fitter.module";
import { FactoryModule } from "./factories/factory.module";
import { FactoryEmployeeModule } from "./factory-employees/factory-employee.module";
import { OrderModule } from "./orders/order.module";
import { OrderLineModule } from "./order-lines/order-line.module";
import { CacheModule } from "./cache/cache.module";
import { EnrichedOrdersModule } from "./enriched-orders/enriched-orders.module";
import { AuditLoggingModule } from "./audit-logging/audit-logging.module";
import { BrandModule } from "./brands/brand.module";
// import { ModelModule } from "./models/model.module";
import { LeathertypeModule } from "./leathertypes/leathertype.module";
import { OptionModule } from "./options/option.module";
import { OptionItemModule } from "./options-items/option-item.module";
import { SaddleModule } from "./saddles/saddle.module";
import { SaddleLeatherModule } from "./saddle-leathers/saddle-leather.module";
import { SaddleOptionsItemModule } from "./saddle-options-items/saddle-options-item.module";
import { ExtraModule } from "./extras/extra.module";
import { PresetModule } from "./presets/preset.module";
// import { ProductModule } from "./products/product.module";
import { CommentsModule } from "./comments/comments.module";
import { AccessFilterGroupModule } from "./access-filter-groups/access-filter-group.module";
import { OrderProductSaddleModule } from "./order-product-saddles/order-product-saddle.module";
import { CountryManagerModule } from "./country-managers/country-manager.module";
import { WarehouseModule } from "./warehouses/warehouse.module";
import { SaddleStockModule } from "./saddle-stock/saddle-stock.module";
import { SaddleExtraModule } from "./saddle-extras/saddle-extra.module";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { AuditLogInterceptor } from "./audit-logging/interceptors/audit-log.interceptor";
import { RlsModule } from "./rls/rls.module";
import { EnhancedRlsGuard } from "./rls/rls.guard";

const isTestOrDev =
  process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        databaseConfig,
        authConfig,
        appConfig,
        cacheConfig,
        mailConfig,
        fileConfig,
        redisConfig,
      ],
      envFilePath: [".env"],
    }),
    ThrottlerModule.forRoot(
      isTestOrDev
        ? [
            { name: "short", ttl: 1000, limit: 10000 },
            { name: "medium", ttl: 60000, limit: 10000 },
            { name: "long", ttl: 3600000, limit: 10000 },
          ]
        : [
            { name: "short", ttl: 1000, limit: 3 },
            { name: "medium", ttl: 60000, limit: 100 },
            { name: "long", ttl: 3600000, limit: 600 },
          ],
    ),
    infrastructureDatabaseModule,
    CacheModule,
    UsersModule,
    FilesModule,
    AuthModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
    HealthModule,
    MonitoringModule,
    BehaviorsModule,
    CustomerModule,
    FitterModule,
    FactoryModule,
    FactoryEmployeeModule,
    OrderModule,
    OrderLineModule,
    OrderProductSaddleModule, // Order-Product relationships ✅ - enabled
    EnrichedOrdersModule,
    AuditLoggingModule,
    CommentsModule, // Comments module ✅ - enabled
    AccessFilterGroupModule, // Access filter groups ✅ - enabled
    CountryManagerModule, // Country managers ✅ - enabled
    WarehouseModule, // Warehouses ✅ - enabled
    // Product modules - temporarily disabled pending migration
    BrandModule, // Simplified ✅ - enabled
    // ModelModule, // Simplified ✅ - ready for enable after migration
    LeathertypeModule, // Legacy entity ✅ - enabled
    OptionModule, // Enhanced with 7-tier pricing ✅ - enabled
    OptionItemModule, // Option items with 7-tier pricing ✅ - enabled
    SaddleModule, // Master saddle/product entity ✅ - enabled
    SaddleLeatherModule, // Saddle-leather associations ✅ - enabled
    SaddleOptionsItemModule, // Saddle-option-item configurations ✅ - enabled
    ExtraModule, // Extras with 7-tier pricing ✅ - enabled
    PresetModule, // Legacy entity ✅ - enabled
    // ProductModule, // Needs implementation
    SaddleStockModule, // Saddle stock (fitter inventory) ✅ - enabled
    SaddleExtraModule, // Saddle-extra associations ✅ - enabled
    RlsModule, // Row Level Security ✅ - enabled
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: EnhancedRlsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
