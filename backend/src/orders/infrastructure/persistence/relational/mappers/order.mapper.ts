import { Injectable } from "@nestjs/common";
import { Order } from "../../../../domain/order";
import { OrderId } from "../../../../domain/value-objects/order-id.value-object";
import { OrderStatus } from "../../../../domain/value-objects/order-status.value-object";
import { OrderPriority } from "../../../../domain/value-objects/order-priority.value-object";
import { OrderEntity } from "../entities/order.entity";

/**
 * Order Infrastructure Mapper
 *
 * Maps between domain entities and TypeORM entities.
 * Handles the conversion of domain value objects to database primitives.
 */
@Injectable()
export class OrderMapper {
  /**
   * Convert domain entity to TypeORM entity
   */
  toPersistence(domain: Order): OrderEntity {
    const entity = new OrderEntity();

    // Convert OrderId value object to number
    const idValue = domain.id.toString();
    entity.id = parseInt(idValue, 10);

    entity.customerId = domain.customerId;
    entity.orderNumber = domain.orderNumber;
    entity.status = domain.status.toString();
    entity.priority = domain.priority.toString();
    entity.fitterId = domain.fitterId;
    entity.factoryId = domain.factoryId;
    entity.saddleSpecifications = { ...domain.saddleSpecifications };
    entity.specialInstructions = domain.specialInstructions;
    entity.estimatedDeliveryDate = domain.estimatedDeliveryDate;
    entity.actualDeliveryDate = domain.actualDeliveryDate;
    entity.totalAmount = domain.totalAmount;
    entity.depositPaid = domain.depositPaid;
    entity.balanceOwing = domain.balanceOwing;
    entity.measurements = domain.measurements
      ? { ...domain.measurements }
      : null;
    entity.isUrgent = domain.isUrgent;
    entity.seatSizes = domain.seatSizes;
    entity.customerName = domain.customerName;
    entity.saddleId = domain.saddleId;
    entity.createdAt = domain.createdAt;
    entity.updatedAt = domain.updatedAt;

    return entity;
  }

  /**
   * Convert TypeORM entity to domain entity
   */
  toDomain(entity: OrderEntity): Order {
    // Convert number ID to OrderId value object
    const orderId = OrderId.fromString(entity.id.toString());
    const status = OrderStatus.fromString(entity.status);
    const priority = OrderPriority.fromString(entity.priority);

    // Use private constructor through Object.create and Object.defineProperty
    const order = Object.create(Order.prototype);

    // Set private properties using Object.defineProperty
    Object.defineProperty(order, "_id", { value: orderId, writable: false });
    Object.defineProperty(order, "_customerId", {
      value: entity.customerId,
      writable: false,
    });
    Object.defineProperty(order, "_orderNumber", {
      value: entity.orderNumber,
      writable: true,
    });
    Object.defineProperty(order, "_status", { value: status, writable: true });
    Object.defineProperty(order, "_priority", {
      value: priority,
      writable: true,
    });
    Object.defineProperty(order, "_fitterId", {
      value: entity.fitterId,
      writable: true,
    });
    Object.defineProperty(order, "_factoryId", {
      value: entity.factoryId,
      writable: true,
    });
    Object.defineProperty(order, "_saddleSpecifications", {
      value: { ...entity.saddleSpecifications },
      writable: true,
    });
    Object.defineProperty(order, "_specialInstructions", {
      value: entity.specialInstructions,
      writable: true,
    });
    Object.defineProperty(order, "_estimatedDeliveryDate", {
      value: entity.estimatedDeliveryDate,
      writable: true,
    });
    Object.defineProperty(order, "_actualDeliveryDate", {
      value: entity.actualDeliveryDate,
      writable: true,
    });
    Object.defineProperty(order, "_totalAmount", {
      value: entity.totalAmount,
      writable: true,
    });
    Object.defineProperty(order, "_depositPaid", {
      value: entity.depositPaid,
      writable: true,
    });
    Object.defineProperty(order, "_balanceOwing", {
      value: entity.balanceOwing,
      writable: true,
    });
    Object.defineProperty(order, "_measurements", {
      value: entity.measurements ? { ...entity.measurements } : null,
      writable: true,
    });
    Object.defineProperty(order, "_isUrgent", {
      value: entity.isUrgent,
      writable: true,
    });
    Object.defineProperty(order, "_createdAt", {
      value: entity.createdAt,
      writable: false,
    });
    Object.defineProperty(order, "_updatedAt", {
      value: entity.updatedAt,
      writable: true,
    });
    Object.defineProperty(order, "_seatSizes", {
      value: entity.seatSizes,
      writable: true,
    });
    Object.defineProperty(order, "_customerName", {
      value: entity.customerName,
      writable: true,
    });
    Object.defineProperty(order, "_saddleId", {
      value: entity.saddleId,
      writable: true,
    });
    Object.defineProperty(order, "_domainEvents", {
      value: [],
      writable: true,
    });

    return order;
  }

  /**
   * Convert multiple TypeORM entities to domain entities
   */
  toDomainMany(entities: OrderEntity[]): Order[] {
    return entities.map((entity) => this.toDomain(entity));
  }

  /**
   * Convert multiple domain entities to TypeORM entities
   */
  toPersistenceMany(domains: Order[]): OrderEntity[] {
    return domains.map((domain) => this.toPersistence(domain));
  }
}
