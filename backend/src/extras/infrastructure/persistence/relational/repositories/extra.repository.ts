import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, IsNull, Like } from "typeorm";
import { IExtraRepository } from "../../../../domain/extra.repository";
import { Extra } from "../../../../domain/extra";
import { ExtraEntity } from "../entities/extra.entity";
import { ExtraId } from "../../../../domain/value-objects/extra-id.value-object";
import { ExtraMapper } from "../mappers/extra.mapper";

/**
 * Extra Repository Implementation
 *
 * Implements the domain repository interface using TypeORM.
 * Uses UUID IDs and soft delete via deletedAt.
 */
@Injectable()
export class ExtraRepository implements IExtraRepository {
  constructor(
    @InjectRepository(ExtraEntity)
    private readonly repository: Repository<ExtraEntity>,
    private readonly mapper: ExtraMapper,
  ) {}

  async findById(id: ExtraId): Promise<Extra | null> {
    const entity = await this.repository.findOne({
      where: { id: id.value, deletedAt: IsNull() },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByName(name: string): Promise<Extra | null> {
    const entity = await this.repository.findOne({
      where: { name, deletedAt: IsNull() },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findAll(options: {
    page: number;
    limit: number;
    search?: string;
  }): Promise<{ extras: Extra[]; total: number }> {
    const { page, limit, search } = options;
    const where: any = { deletedAt: IsNull() };

    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [entities, total] = await this.repository.findAndCount({
      where,
      order: { sequence: "ASC", name: "ASC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      extras: this.mapper.toDomainArray(entities),
      total,
    };
  }

  async findActive(): Promise<Extra[]> {
    const entities = await this.repository.find({
      where: { deletedAt: IsNull() },
      order: { sequence: "ASC", name: "ASC" },
    });
    return this.mapper.toDomainArray(entities);
  }

  async save(extra: Extra): Promise<Extra> {
    const existingEntity = await this.repository.findOne({
      where: { id: extra.id.value },
    });

    let savedEntity: ExtraEntity;
    if (existingEntity) {
      const updatedEntity = this.mapper.updateEntity(existingEntity, extra);
      savedEntity = await this.repository.save(updatedEntity);
    } else {
      const newEntity = this.mapper.toEntity(extra);
      savedEntity = await this.repository.save(newEntity);
    }

    return this.mapper.toDomain(savedEntity);
  }

  async softDelete(id: ExtraId): Promise<void> {
    await this.repository.update({ id: id.value }, { deletedAt: new Date() });
  }
}
