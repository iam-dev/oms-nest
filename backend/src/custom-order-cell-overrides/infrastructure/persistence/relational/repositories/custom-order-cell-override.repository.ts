import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { CustomOrderCellOverrideEntity } from "../entities/custom-order-cell-override.entity";

@Injectable()
export class CustomOrderCellOverrideRepository {
  constructor(
    @InjectRepository(CustomOrderCellOverrideEntity)
    private readonly repository: Repository<CustomOrderCellOverrideEntity>,
  ) {}

  async upsert(
    data: Partial<CustomOrderCellOverrideEntity>,
  ): Promise<CustomOrderCellOverrideEntity> {
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(CustomOrderCellOverrideEntity)
      .values({
        userId: data.userId,
        orderId: data.orderId,
        columnKey: data.columnKey,
        overrideValue: data.overrideValue,
      })
      .orUpdate(
        ["override_value", "updated_at"],
        ["user_id", "order_id", "column_key"],
      )
      .returning("*")
      .execute();

    return result.generatedMaps[0] as CustomOrderCellOverrideEntity;
  }

  async bulkUpsert(
    items: Partial<CustomOrderCellOverrideEntity>[],
  ): Promise<CustomOrderCellOverrideEntity[]> {
    if (items.length === 0) return [];

    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(CustomOrderCellOverrideEntity)
      .values(
        items.map((item) => ({
          userId: item.userId,
          orderId: item.orderId,
          columnKey: item.columnKey,
          overrideValue: item.overrideValue,
        })),
      )
      .orUpdate(
        ["override_value", "updated_at"],
        ["user_id", "order_id", "column_key"],
      )
      .returning("*")
      .execute();

    return result.generatedMaps as CustomOrderCellOverrideEntity[];
  }

  async findByUser(
    userId: number,
    orderIds?: number[],
  ): Promise<CustomOrderCellOverrideEntity[]> {
    const where: Record<string, unknown> = { userId };
    if (orderIds && orderIds.length > 0) {
      where.orderId = In(orderIds);
    }
    return this.repository.find({ where });
  }

  async findByOrder(
    userId: number,
    orderId: number,
  ): Promise<CustomOrderCellOverrideEntity[]> {
    return this.repository.find({ where: { userId, orderId } });
  }

  async findById(id: number): Promise<CustomOrderCellOverrideEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByOrderAndColumn(
    userId: number,
    orderId: number,
    columnKey: string,
  ): Promise<void> {
    await this.repository.delete({ userId, orderId, columnKey });
  }
}
