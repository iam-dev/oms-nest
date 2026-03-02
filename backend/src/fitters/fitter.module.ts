import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { FitterService } from "./fitter.service";
import { FitterController } from "./fitter.controller";
import { FitterRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { UserEntity } from "../users/infrastructure/persistence/relational/entities/user.entity";
import { MailModule } from "../mail/mail.module";

/**
 * Fitter Module
 *
 * Orchestrates all fitter-related functionality following hexagonal architecture.
 * Imports UserEntity for cross-entity password update operations.
 */
@Module({
  imports: [
    FitterRelationalPersistenceModule,
    TypeOrmModule.forFeature([UserEntity]),
    MailModule,
    JwtModule.register({}),
  ],
  controllers: [FitterController],
  providers: [FitterService],
  exports: [FitterService],
})
export class FitterModule {}
