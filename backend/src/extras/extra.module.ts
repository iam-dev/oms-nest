import { Module } from "@nestjs/common";
import { ExtraService } from "./extra.service";
import { ExtraController } from "./extra.controller";
import { ExtraRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";

/**
 * Extra Module
 *
 * Orchestrates all extra-related functionality following hexagonal architecture.
 */
@Module({
  imports: [ExtraRelationalPersistenceModule],
  controllers: [ExtraController],
  providers: [ExtraService],
  exports: [ExtraService],
})
export class ExtraModule {}
