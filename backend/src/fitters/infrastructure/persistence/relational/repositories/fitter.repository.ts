import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { IFitterRepository } from "../../../../domain/fitter.repository";
import { Fitter } from "../../../../domain/fitter";
import { FitterEntity } from "../entities/fitter.entity";
import { FitterMapper } from "../mappers/fitter.mapper";

/**
 * Fitter Repository Implementation
 *
 * Implements the domain repository interface using TypeORM.
 * Uses integer IDs and soft delete via `deleted` column.
 */
@Injectable()
export class FitterRepository implements IFitterRepository {
  constructor(
    @InjectRepository(FitterEntity)
    private readonly repository: Repository<FitterEntity>,
    private readonly mapper: FitterMapper,
  ) {}

  async findById(id: number): Promise<Fitter | null> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByUserId(userId: number): Promise<Fitter | null> {
    const entity = await this.repository.findOne({
      where: { userId, deleted: 0 },
    });
    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findAllPaginated(options: {
    page: number;
    limit: number;
    city?: string;
    country?: string;
  }): Promise<{ fitters: Fitter[]; total: number }> {
    const { page, limit, city, country } = options;

    const queryBuilder = this.repository
      .createQueryBuilder("fitter")
      .where("fitter.deleted = 0");

    if (city) {
      queryBuilder.andWhere("fitter.city ILIKE :city", {
        city: `%${city}%`,
      });
    }

    if (country) {
      queryBuilder.andWhere("fitter.country ILIKE :country", {
        country: `%${country}%`,
      });
    }

    queryBuilder.orderBy("fitter.city", "ASC");

    const total = await queryBuilder.getCount();
    const entities = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      fitters: this.mapper.toDomainArray(entities),
      total,
    };
  }

  async findActive(): Promise<Fitter[]> {
    const entities = await this.repository.find({
      where: { deleted: 0 },
      order: { city: "ASC" },
    });
    return this.mapper.toDomainArray(entities);
  }

  async findByCountry(country: string): Promise<Fitter[]> {
    const entities = await this.repository
      .createQueryBuilder("fitter")
      .where("fitter.deleted = 0")
      .andWhere("fitter.country ILIKE :country", {
        country: `%${country}%`,
      })
      .orderBy("fitter.city", "ASC")
      .getMany();
    return this.mapper.toDomainArray(entities);
  }

  async findByCity(city: string): Promise<Fitter[]> {
    const entities = await this.repository
      .createQueryBuilder("fitter")
      .where("fitter.deleted = 0")
      .andWhere("fitter.city ILIKE :city", { city: `%${city}%` })
      .getMany();
    return this.mapper.toDomainArray(entities);
  }

  async countByCountry(country: string): Promise<number> {
    return this.repository
      .createQueryBuilder("fitter")
      .where("fitter.deleted = 0")
      .andWhere("fitter.country ILIKE :country", {
        country: `%${country}%`,
      })
      .getCount();
  }

  async countActive(): Promise<number> {
    return this.repository.count({
      where: { deleted: 0 },
    });
  }

  async save(fitter: Fitter): Promise<Fitter> {
    if (fitter.id) {
      const existingEntity = await this.repository.findOne({
        where: { id: fitter.id },
      });

      if (existingEntity) {
        const updatedEntity = this.mapper.updateEntity(existingEntity, fitter);
        const savedEntity = await this.repository.save(updatedEntity);
        return this.mapper.toDomain(savedEntity);
      }
    }

    const newEntity = this.mapper.toEntity(fitter);
    const savedEntity = await this.repository.save(newEntity);
    return this.mapper.toDomain(savedEntity);
  }

  async softDelete(id: number): Promise<void> {
    await this.repository.update({ id }, { deleted: 1 });
  }
}
