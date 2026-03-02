import { Module } from "@nestjs/common";
import { CustomOrderViewService } from "./custom-order-view.service";
import { CustomOrderViewController } from "./custom-order-view.controller";
import { CustomOrderViewRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";

@Module({
  imports: [CustomOrderViewRelationalPersistenceModule],
  controllers: [CustomOrderViewController],
  providers: [CustomOrderViewService],
  exports: [CustomOrderViewService],
})
export class CustomOrderViewModule {}
