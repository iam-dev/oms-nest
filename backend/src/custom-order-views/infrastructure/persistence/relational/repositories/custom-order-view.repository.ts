import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomOrderViewEntity } from "../entities/custom-order-view.entity";

@Injectable()
export class CustomOrderViewRepository {
  constructor(
    @InjectRepository(CustomOrderViewEntity)
    private readonly repository: Repository<CustomOrderViewEntity>,
  ) {}

  async create(
    data: Partial<CustomOrderViewEntity>,
  ): Promise<CustomOrderViewEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAllByUser(userId: number): Promise<CustomOrderViewEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { name: "ASC" },
    });
  }

  async findById(id: number): Promise<CustomOrderViewEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findDefault(userId: number): Promise<CustomOrderViewEntity | null> {
    return this.repository.findOne({
      where: { userId, isDefault: true },
    });
  }

  async clearDefaults(userId: number): Promise<void> {
    await this.repository.update(
      { userId, isDefault: true },
      { isDefault: false },
    );
  }

  async update(
    id: number,
    data: Partial<CustomOrderViewEntity>,
  ): Promise<CustomOrderViewEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    Object.assign(existing, data);
    await this.repository.save(existing);
    return this.findById(id);
  }

  async findByGroup(groupId: number): Promise<CustomOrderViewEntity[]> {
    return this.repository.find({
      where: { groupId },
      order: { tabOrder: "ASC", name: "ASC" },
    });
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
