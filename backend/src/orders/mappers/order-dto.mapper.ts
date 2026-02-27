import { Injectable } from "@nestjs/common";
import { Order } from "../domain/order";
import { OrderDto } from "../dto/order.dto";

/**
 * Order DTO Mapper
 *
 * Maps between domain entities and DTOs for API responses
 */
@Injectable()
export class OrderMapper {
  /**
   * Convert domain entity to DTO
   */
  toDto(order: Order): OrderDto {
    const dto = new OrderDto();

    dto.id = order.id.getValue();
    dto.customerId = order.customerId;
    dto.orderNumber = order.orderNumber;
    dto.status = order.status.toString();
    dto.priority = order.priority.toString();
    dto.fitterId = order.fitterId;
    dto.factoryId = order.factoryId;
    dto.saddleSpecifications = { ...order.saddleSpecifications };
    dto.specialInstructions = order.specialInstructions;
    dto.estimatedDeliveryDate = order.estimatedDeliveryDate;
    dto.actualDeliveryDate = order.actualDeliveryDate;
    dto.totalAmount = order.totalAmount;
    dto.depositPaid = order.depositPaid;
    dto.balanceOwing = order.balanceOwing;
    dto.measurements = order.measurements ? { ...order.measurements } : null;
    dto.isUrgent = order.isUrgent;
    dto.seatSizes = order.seatSizes;
    dto.customerName = order.customerName;
    dto.saddleId = order.saddleId;
    dto.isOverdue = order.isOverdue();
    dto.daysUntilDelivery = order.getDaysUntilDelivery();
    dto.paymentPercentage = order.getPaymentPercentage();
    dto.createdAt = order.createdAt;
    dto.updatedAt = order.updatedAt;

    return dto;
  }

  /**
   * Convert multiple domain entities to DTOs
   */
  toDtoMany(orders: Order[]): OrderDto[] {
    return orders.map((order) => this.toDto(order));
  }
}
