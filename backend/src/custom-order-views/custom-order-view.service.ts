import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import { CustomOrderViewRepository } from "./infrastructure/persistence/relational/repositories/custom-order-view.repository";
import { CreateCustomOrderViewDto } from "./dto/create-custom-order-view.dto";
import { UpdateCustomOrderViewDto } from "./dto/update-custom-order-view.dto";
import { CustomOrderViewEntity } from "./infrastructure/persistence/relational/entities/custom-order-view.entity";

@Injectable()
export class CustomOrderViewService {
  constructor(
    private readonly repository: CustomOrderViewRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: number,
    dto: CreateCustomOrderViewDto,
  ): Promise<CustomOrderViewEntity> {
    // BE-013: clearDefaults + create must be atomic to prevent a race where
    // two concurrent requests both clear and then both insert a default view,
    // leaving the user with zero or two defaults.
    if (!dto.isDefault) {
      return this.repository.create({
        userId,
        name: dto.name,
        columns: dto.columns as CustomOrderViewEntity["columns"],
        columnGroups:
          (dto.columnGroups as CustomOrderViewEntity["columnGroups"]) ?? [],
        isDefault: false,
        groupId: dto.groupId ?? null,
        tabOrder: dto.tabOrder ?? 0,
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        CustomOrderViewEntity,
        { userId, isDefault: true },
        { isDefault: false },
      );
      const entity = queryRunner.manager.create(CustomOrderViewEntity, {
        userId,
        name: dto.name,
        columns: dto.columns as CustomOrderViewEntity["columns"],
        columnGroups:
          (dto.columnGroups as CustomOrderViewEntity["columnGroups"]) ?? [],
        isDefault: true,
        groupId: dto.groupId ?? null,
        tabOrder: dto.tabOrder ?? 0,
      });
      const saved = await queryRunner.manager.save(entity);
      await queryRunner.commitTransaction();
      return saved;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
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

    // BE-013: clearDefaults + update must be atomic when promoting to default.
    if (!dto.isDefault) {
      const updated = await this.repository.update(id, data);
      if (!updated) {
        throw new NotFoundException(
          `Failed to update custom order view with ID "${id}"`,
        );
      }
      return updated;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        CustomOrderViewEntity,
        { userId, isDefault: true },
        { isDefault: false },
      );
      await queryRunner.manager.update(CustomOrderViewEntity, { id }, data);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    const updated = await this.repository.findById(id);
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
