import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { ReportSavedFilterRepository } from "./infrastructure/persistence/relational/repositories/report-saved-filter.repository";
import { CreateReportSavedFilterDto } from "./dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "./dto/update-report-saved-filter.dto";
import { ReportSavedFilterEntity } from "./infrastructure/persistence/relational/entities/report-saved-filter.entity";

@Injectable()
export class ReportSavedFilterService {
  constructor(private readonly repository: ReportSavedFilterRepository) {}

  async create(
    userId: number,
    dto: CreateReportSavedFilterDto,
  ): Promise<ReportSavedFilterEntity> {
    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }
    return this.repository.create({
      userId,
      name: dto.name,
      filters: dto.filters,
      isDefault: dto.isDefault ?? false,
    });
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

    if (dto.isDefault) {
      await this.repository.clearDefaults(userId);
    }

    const data: Partial<ReportSavedFilterEntity> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.filters !== undefined) data.filters = dto.filters;
    if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;

    const updated = await this.repository.update(id, data);
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
