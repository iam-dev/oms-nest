import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import { InjectDataSource } from "@nestjs/typeorm";
import { ReportSavedFilterRepository } from "./infrastructure/persistence/relational/repositories/report-saved-filter.repository";
import { CreateReportSavedFilterDto } from "./dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "./dto/update-report-saved-filter.dto";
import { ReportSavedFilterEntity } from "./infrastructure/persistence/relational/entities/report-saved-filter.entity";

@Injectable()
export class ReportSavedFilterService {
  constructor(
    private readonly repository: ReportSavedFilterRepository,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async create(
    userId: number,
    dto: CreateReportSavedFilterDto,
  ): Promise<ReportSavedFilterEntity> {
    // BE-013: clearDefaults + create must be atomic to prevent concurrent
    // requests leaving the user with zero or two default saved filters.
    if (!dto.isDefault) {
      return this.repository.create({
        userId,
        name: dto.name,
        filters: dto.filters,
        isDefault: false,
      });
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        ReportSavedFilterEntity,
        { userId, isDefault: true },
        { isDefault: false },
      );
      const entity = queryRunner.manager.create(ReportSavedFilterEntity, {
        userId,
        name: dto.name,
        filters: dto.filters,
        isDefault: true,
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

  async findAll(userId: number): Promise<ReportSavedFilterEntity[]> {
    return this.repository.findAllByUser(userId);
  }

  async findDefault(userId: number): Promise<ReportSavedFilterEntity | null> {
    return this.repository.findDefault(userId);
  }

  async update(
    id: number,
    userId: number,
    dto: UpdateReportSavedFilterDto,
  ): Promise<ReportSavedFilterEntity> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Saved filter with ID "${id}" not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot modify another user's saved filter");
    }

    const data: Partial<ReportSavedFilterEntity> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.filters !== undefined) data.filters = dto.filters;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    // BE-013: clearDefaults + update must be atomic when promoting to default.
    if (!dto.isDefault) {
      const updated = await this.repository.update(id, data);
      if (!updated) {
        throw new NotFoundException(
          `Failed to update saved filter with ID "${id}"`,
        );
      }
      return updated;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.manager.update(
        ReportSavedFilterEntity,
        { userId, isDefault: true },
        { isDefault: false },
      );
      const toSave = Object.assign(new ReportSavedFilterEntity(), { id }, data);
      await queryRunner.manager.save(ReportSavedFilterEntity, toSave);
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
        `Failed to update saved filter with ID "${id}"`,
      );
    }
    return updated;
  }

  async remove(id: number, userId: number): Promise<void> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Saved filter with ID "${id}" not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException("Cannot delete another user's saved filter");
    }
    await this.repository.delete(id);
  }
}
