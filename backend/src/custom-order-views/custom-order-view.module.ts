import { Module } from "@nestjs/common";
import { CustomOrderViewService } from "./custom-order-view.service";
import { CustomOrderViewController } from "./custom-order-view.controller";
import { CustomOrderViewRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { JwtRolesGuard } from "../auth/guards/jwt-roles.guard";

@Module({
  imports: [CustomOrderViewRelationalPersistenceModule],
  controllers: [CustomOrderViewController],
  providers: [CustomOrderViewService, JwtRolesGuard],
  exports: [CustomOrderViewService],
})
export class CustomOrderViewModule {}
