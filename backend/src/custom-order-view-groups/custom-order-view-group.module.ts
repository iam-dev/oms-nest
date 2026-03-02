import { Module } from "@nestjs/common";
import { CustomOrderViewGroupService } from "./custom-order-view-group.service";
import { CustomOrderViewGroupController } from "./custom-order-view-group.controller";
import { CustomOrderViewGroupRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { CustomOrderViewRelationalPersistenceModule } from "../custom-order-views/infrastructure/persistence/relational/relational-persistence.module";

@Module({
  imports: [
    CustomOrderViewGroupRelationalPersistenceModule,
    CustomOrderViewRelationalPersistenceModule,
  ],
  controllers: [CustomOrderViewGroupController],
  providers: [CustomOrderViewGroupService],
  exports: [CustomOrderViewGroupService],
})
export class CustomOrderViewGroupModule {}
