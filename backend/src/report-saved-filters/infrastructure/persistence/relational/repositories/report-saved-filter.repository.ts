import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReportSavedFilterEntity } from "../entities/report-saved-filter.entity";

@Injectable()
export class ReportSavedFilterRepository {
  constructor(
    @InjectRepository(ReportSavedFilterEntity)
    private readonly repository: Repository<ReportSavedFilterEntity>,
  ) {}

  async create(
    data: Partial<ReportSavedFilterEntity>,
  ): Promise<ReportSavedFilterEntity> {
    const entity = this.repository.create(data);
    return this.repository.save(entity);
  }

  async findAllByUser(userId: number): Promise<ReportSavedFilterEntity[]> {
    return this.repository.find({
      where: { userId },
      order: { name: "ASC" },
    });
  }

  async findById(id: number): Promise<ReportSavedFilterEntity | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findDefault(userId: number): Promise<ReportSavedFilterEntity | null> {
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
    data: Partial<ReportSavedFilterEntity>,
  ): Promise<ReportSavedFilterEntity | null> {
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
