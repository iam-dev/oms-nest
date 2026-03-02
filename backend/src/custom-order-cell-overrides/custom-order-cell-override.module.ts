import { Module } from "@nestjs/common";
import { CustomOrderCellOverrideService } from "./custom-order-cell-override.service";
import { CustomOrderCellOverrideController } from "./custom-order-cell-override.controller";
import { CustomOrderCellOverrideRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";

@Module({
  imports: [CustomOrderCellOverrideRelationalPersistenceModule],
  controllers: [CustomOrderCellOverrideController],
  providers: [CustomOrderCellOverrideService],
  exports: [CustomOrderCellOverrideService],
})
export class CustomOrderCellOverrideModule {}
