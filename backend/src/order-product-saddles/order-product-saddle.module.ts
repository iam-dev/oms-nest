import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderProductSaddleEntity } from "./infrastructure/persistence/relational/entities/order-product-saddle.entity";
import { OrderProductSaddleController } from "./order-product-saddle.controller";
import { OrderProductSaddleService } from "./order-product-saddle.service";
import { EnrichedOrdersModule } from "../enriched-orders/enriched-orders.module";

/**
 * OrderProductSaddle Module
 *
 * Manages the relationships between orders and products (saddles).
 * Provides functionality for linking products to orders with configuration,
 * quantity, and product-specific details.
 */
@Module({
  // EnrichedOrdersModule supplies the fitter lock lookups for writes.
  imports: [
    TypeOrmModule.forFeature([OrderProductSaddleEntity]),
    EnrichedOrdersModule,
  ],
  controllers: [OrderProductSaddleController],
  providers: [OrderProductSaddleService],
  exports: [OrderProductSaddleService],
})
export class OrderProductSaddleModule {}
