import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CustomOrderViewEntity } from "./entities/custom-order-view.entity";
import { CustomOrderViewRepository } from "./repositories/custom-order-view.repository";

@Module({
  imports: [TypeOrmModule.forFeature([CustomOrderViewEntity])],
  providers: [CustomOrderViewRepository],
  exports: [CustomOrderViewRepository],
})
export class CustomOrderViewRelationalPersistenceModule {}
