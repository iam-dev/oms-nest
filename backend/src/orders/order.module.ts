import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderService } from "./order.service";
import { OrderSearchService } from "./order-search.service";
import { OrderController } from "./order.controller";
import { OrderRelationalPersistenceModule } from "./infrastructure/persistence/relational/relational-persistence.module";
import { OrderMapper } from "./mappers/order-dto.mapper";
import { OrderEntity } from "./infrastructure/persistence/relational/entities/order.entity";
import { EnrichedOrdersModule } from "../enriched-orders/enriched-orders.module";

/**
 * Order Module
 *
 * Orchestrates all order-related functionality following hexagonal architecture.
 * Provides comprehensive order management capabilities including lifecycle management,
 * status transitions, priority handling, and production scheduling.
 */
@Module({
  imports: [
    OrderRelationalPersistenceModule,
    TypeOrmModule.forFeature([OrderEntity]),
    EnrichedOrdersModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, OrderSearchService, OrderMapper],
  exports: [OrderService, OrderSearchService, OrderMapper],
})
export class OrderModule {}
