import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomOrderViewGroupEntity } from "../entities/custom-order-view-group.entity";

@Injectable()
export class CustomOrderViewGroupRepository {
  constructor(
    @InjectRepository(CustomOrderViewGroupEntity)
    private readonly repository: Repository<CustomOrderViewGroupEntity>,
  ) {}

  async create(
    data: Partial<CustomOrderViewGroupEntity>,
  ): Promise<CustomOrderViewGroupEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAllByUser(userId: number): Promise<CustomOrderViewGroupEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { name: "ASC" },
    });
  }

  async findById(id: number): Promise<CustomOrderViewGroupEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(
    id: number,
    data: Partial<CustomOrderViewGroupEntity>,
  ): Promise<CustomOrderViewGroupEntity | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    Object.assign(existing, data);
    await this.repository.save(existing);
    return this.findById(id);
  }

  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
