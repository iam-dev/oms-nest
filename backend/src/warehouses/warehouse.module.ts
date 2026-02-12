import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { WarehouseEntity } from "./infrastructure/persistence/relational/entities/warehouse.entity";
import { WarehouseService } from "./warehouse.service";
import { WarehouseController } from "./warehouse.controller";

@Module({
  imports: [TypeOrmModule.forFeature([WarehouseEntity])],
  controllers: [WarehouseController],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
