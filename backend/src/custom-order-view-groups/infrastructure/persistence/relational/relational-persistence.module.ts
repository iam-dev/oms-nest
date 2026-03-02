import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomOrderViewGroupEntity } from "./entities/custom-order-view-group.entity";
import { CustomOrderViewGroupRepository } from "./repositories/custom-order-view-group.repository";

@Module({
  imports: [TypeOrmModule.forFeature([CustomOrderViewGroupEntity])],
  providers: [CustomOrderViewGroupRepository],
  exports: [CustomOrderViewGroupRepository],
})
export class CustomOrderViewGroupRelationalPersistenceModule {}
