import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { CustomOrderViewGroupRepository } from "./infrastructure/persistence/relational/repositories/custom-order-view-group.repository";
import { CustomOrderViewRepository } from "../custom-order-views/infrastructure/persistence/relational/repositories/custom-order-view.repository";
import { CreateCustomOrderViewGroupDto } from "./dto/create-custom-order-view-group.dto";
import { UpdateCustomOrderViewGroupDto } from "./dto/update-custom-order-view-group.dto";
import { CustomOrderViewGroupEntity } from "./infrastructure/persistence/relational/entities/custom-order-view-group.entity";
import { CustomOrderViewEntity } from "../custom-order-views/infrastructure/persistence/relational/entities/custom-order-view.entity";

export interface ViewGroupWithViews extends CustomOrderViewGroupEntity {
  views: CustomOrderViewEntity[];
}

@Injectable()
export class CustomOrderViewGroupService {
  constructor(
    private readonly repository: CustomOrderViewGroupRepository,
    private readonly viewRepository: CustomOrderViewRepository,
  ) {}

  async create(
    userId: number,
    dto: CreateCustomOrderViewGroupDto,
  ): Promise<CustomOrderViewGroupEntity> {
    return this.repository.create({
      userId,
      name: dto.name,
    });
  }

  async findAll(userId: number): Promise<CustomOrderViewGroupEntity[]> {
    return this.repository.findAllByUser(userId);
  }

  async findAllWithViews(userId: number): Promise<ViewGroupWithViews[]> {
    const groups = await this.repository.findAllByUser(userId);
    const result: ViewGroupWithViews[] = [];

    for (const group of groups) {
      const views = group.id
        ? await this.viewRepository.findByGroup(group.id)
        : [];
      result.push(Object.assign({}, group, { views }) as ViewGroupWithViews);
    }

    return result;
  }

  async findOne(id: number, userId: number): Promise<ViewGroupWithViews> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view group with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot access another user's view group");
    }
    const views = existing.id
      ? await this.viewRepository.findByGroup(existing.id)
      : [];
    return Object.assign({}, existing, { views }) as ViewGroupWithViews;
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateCustomOrderViewGroupDto,
  ): Promise<CustomOrderViewGroupEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view group with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's view group");
    }

    const data: Partial<CustomOrderViewGroupEntity> = {};
    if (dto.name !== undefined) data.name = dto.name;

    const updated = await this.repository.update(id, data);
    if (!updated) {
      throw new NotFoundException(
        `Failed to update custom order view group with ID "${id}"`,
      );
    }
    return updated;
  }

  async remove(id: number, userId: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(
        `Custom order view group with ID "${id}" not found`,
      );
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot delete another user's view group");
    }
    await this.repository.delete(id);
  }
}
