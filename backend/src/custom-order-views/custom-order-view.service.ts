import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CustomOrderViewRepository } from "./infrastructure/persistence/relational/repositories/custom-order-view.repository";
import { CreateCustomOrderViewDto } from "./dto/create-custom-order-view.dto";
import { UpdateCustomOrderViewDto } from "./dto/update-custom-order-view.dto";
import { CustomOrderViewEntity } from "./infrastructure/persistence/relational/entities/custom-order-view.entity";

@Injectable()
export class CustomOrderViewService {
  constructor(private readonly repository: CustomOrderViewRepository) {}

  async create(
    userId: number,
    dto: CreateCustomOrderViewDto,
  ): Promise<CustomOrderViewEntity> {
    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }
    return this.repository.create({
      userId,
      name: dto.name,
      columns: dto.columns as CustomOrderViewEntity["columns"],
      columnGroups:
        (dto.columnGroups as CustomOrderViewEntity["columnGroups"]) ?? [],
      isDefault: dto.isDefault ?? false,
      groupId: dto.groupId ?? null,
      tabOrder: dto.tabOrder ?? 0,
    });
  }

  async findAll(userId: number): Promise<CustomOrderViewEntity[]> {
    return this.repository.findAllByUser(userId);
  }

  async findOne(id: number, userId: number): Promise<CustomOrderViewEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot access another user's view");
    }
    return existing;
  }

  async findDefault(userId: number): Promise<CustomOrderViewEntity | null> {
    return this.repository.findDefault(userId);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateCustomOrderViewDto,
  ): Promise<CustomOrderViewEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's view");
    }

    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }

    const data: Partial<CustomOrderViewEntity> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.columns !== undefined)
      data.columns = dto.columns as CustomOrderViewEntity["columns"];
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
    if (dto.columnGroups !== undefined)
      data.columnGroups =
        dto.columnGroups as CustomOrderViewEntity["columnGroups"];
    if (dto.groupId !== undefined) data.groupId = dto.groupId ?? null;
    if (dto.tabOrder !== undefined) data.tabOrder = dto.tabOrder;

    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new NotFoundException(
        `Failed to update custom order view with ID "${id}"`,
      );
    }
    return updated;
  }

  async remove(id: number, userId: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot delete another user's view");
    }
    await this.repository.delete(id);
  }
}
