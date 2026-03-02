import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomOrderCellOverrideEntity } from "./entities/custom-order-cell-override.entity";
import { CustomOrderCellOverrideRepository } from "./repositories/custom-order-cell-override.repository";

@Module({
  imports: [TypeOrmModule.forFeature([CustomOrderCellOverrideEntity])],
  providers: [CustomOrderCellOverrideRepository],
  exports: [CustomOrderCellOverrideRepository],
})
export class CustomOrderCellOverrideRelationalPersistenceModule {}
