import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CustomOrderCellOverrideRepository } from "./infrastructure/persistence/relational/repositories/custom-order-cell-override.repository";
import { CreateCellOverrideDto } from "./dto/create-cell-override.dto";
import { BulkUpsertCellOverrideDto } from "./dto/bulk-upsert-cell-override.dto";
import { CustomOrderCellOverrideEntity } from "./infrastructure/persistence/relational/entities/custom-order-cell-override.entity";

@Injectable()
export class CustomOrderCellOverrideService {
  constructor(private readonly repository: CustomOrderCellOverrideRepository) {}

  async upsert(
    userId: number,
    dto: CreateCellOverrideDto,
  ): Promise<CustomOrderCellOverrideEntity> {
    return this.repository.upsert({
      userId,
      orderId: dto.orderId,
      columnKey: dto.columnKey,
      overrideValue: dto.overrideValue,
    });
  }

  async bulkUpsert(
    userId: number,
    dto: BulkUpsertCellOverrideDto,
  ): Promise<CustomOrderCellOverrideEntity[]> {
    const items = (dto.overrides ?? []).map((o) => ({
      userId,
      orderId: o.orderId,
      columnKey: o.columnKey,
      overrideValue: o.overrideValue,
    }));
    return this.repository.bulkUpsert(items);
  }

  async findByUser(
    userId: number,
    orderIds?: number[],
  ): Promise<CustomOrderCellOverrideEntity[]> {
    return this.repository.findByUser(userId, orderIds);
  }

  async findByOrder(
    userId: number,
    orderId: number,
  ): Promise<CustomOrderCellOverrideEntity[]> {
    return this.repository.findByOrder(userId, orderId);
  }

  async remove(id: number, userId: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Cell override with ID "${id}" not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException(
        "Cannot delete another user's cell override",
      );
    }
    await this.repository.delete(id);
  }

  async removeByOrderAndColumn(
    userId: number,
    orderId: number,
    columnKey: string,
  ): Promise<void> {
    await this.repository.deleteByOrderAndColumn(userId, orderId, columnKey);
  }
}
