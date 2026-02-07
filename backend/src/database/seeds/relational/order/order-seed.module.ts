import { Module } from "@nestjs/common";
import { OrderSeedService } from "./order-seed.service";

@Module({
  providers: [OrderSeedService],
  exports: [OrderSeedService],
})
export class OrderSeedModule {}
