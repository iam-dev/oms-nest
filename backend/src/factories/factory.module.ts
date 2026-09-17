import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { FactoryService } from "./factory.service";
import { FactoryController } from "./factory.controller";
import { FactoryEntity } from "./infrastructure/persistence/relational/entities/factory.entity";
import { MailModule } from "../mail/mail.module";

/**
 * Factory Module
 *
 * Manages factory-related functionality with simplified architecture.
 * Uses TypeORM repository directly for data access.
 * MailModule + JwtModule are needed to send the set-password welcome email
 * when a factory login account is created.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FactoryEntity]),
    MailModule,
    JwtModule.register({}),
  ],
  controllers: [FactoryController],
  providers: [FactoryService],
  exports: [FactoryService],
})
export class FactoryModule {}
