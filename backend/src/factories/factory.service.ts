import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { FactoryEntity } from "./infrastructure/persistence/relational/entities/factory.entity";
import { CreateFactoryDto } from "./dto/create-factory.dto";
import { UpdateFactoryDto } from "./dto/update-factory.dto";
import { FactoryDto } from "./dto/factory.dto";

/**
 * Factory Application Service
 *
 * Manages factory operations with simplified schema.
 * Uses integer IDs to match PostgreSQL schema.
 */
@Injectable()
export class FactoryService {
  constructor(
    @InjectRepository(FactoryEntity)
    private readonly factoryRepository: Repository<FactoryEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Create a new factory
   */
  async create(createFactoryDto: CreateFactoryDto): Promise<FactoryDto> {
    const factory = this.factoryRepository.create({
      userId: createFactoryDto.userId ?? null,
      address: createFactoryDto.address ?? null,
      zipcode: createFactoryDto.zipcode ?? null,
      state: createFactoryDto.state ?? null,
      city: createFactoryDto.city ?? null,
      country: createFactoryDto.country ?? null,
      phoneNo: createFactoryDto.phoneNo ?? null,
      cellNo: createFactoryDto.cellNo ?? null,
      currency: createFactoryDto.currency ?? null,
      emailaddress: createFactoryDto.emailaddress ?? null,
      deleted: 0,
    });

    const savedFactory = await this.factoryRepository.save(factory);
    return this.toDto(savedFactory);
  }

  /**
   * Find factory by ID
   */
  async findOne(id: number): Promise<FactoryDto> {
    const factory = await this.factoryRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!factory) {
      throw new NotFoundException("Factory not found");
    }

    return this.toDto(factory);
  }

  /**
   * Find all factories with filtering and pagination.
   * JOINs with user view to get proper name, username, enabled, lastLogin.
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    city?: string,
    country?: string,
  ): Promise<{ data: FactoryDto[]; total: number; pages: number }> {
    const queryBuilder = this.factoryRepository
      .createQueryBuilder("factory")
      .leftJoinAndMapOne(
        "factory._user",
        "user",
        "u",
        "factory.user_id = u.legacy_id",
      )
      .where("factory.deleted = 0");

    if (city) {
      queryBuilder.andWhere("factory.city ILIKE :city", { city: `%${city}%` });
    }

    if (country) {
      queryBuilder.andWhere("factory.country ILIKE :country", {
        country: `%${country}%`,
      });
    }

    queryBuilder.orderBy("factory.city", "ASC");

    const total = await queryBuilder.getCount();
    const factories = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getRawAndEntities();

    // Build DTOs with user data from raw results
    const rawRows = factories.raw;
    const entities = factories.entities;
    const data = entities.map((factory, idx) => {
      const raw = rawRows[idx];
      const dto = this.toDto(factory);
      dto.name = raw?.u_name || undefined;
      dto.username = raw?.u_username || undefined;
      dto.enabled = raw?.u_enabled ?? undefined;
      dto.lastLogin = raw?.u_last_login || undefined;
      return dto;
    });

    return {
      data,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update factory
   */
  async update(
    id: number,
    updateFactoryDto: UpdateFactoryDto,
  ): Promise<FactoryDto> {
    const factory = await this.factoryRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!factory) {
      throw new NotFoundException("Factory not found");
    }

    // Update fields that are provided
    if (updateFactoryDto.userId !== undefined)
      factory.userId = updateFactoryDto.userId;
    if (updateFactoryDto.address !== undefined)
      factory.address = updateFactoryDto.address;
    if (updateFactoryDto.zipcode !== undefined)
      factory.zipcode = updateFactoryDto.zipcode;
    if (updateFactoryDto.state !== undefined)
      factory.state = updateFactoryDto.state;
    if (updateFactoryDto.city !== undefined)
      factory.city = updateFactoryDto.city;
    if (updateFactoryDto.country !== undefined)
      factory.country = updateFactoryDto.country;
    if (updateFactoryDto.phoneNo !== undefined)
      factory.phoneNo = updateFactoryDto.phoneNo;
    if (updateFactoryDto.cellNo !== undefined)
      factory.cellNo = updateFactoryDto.cellNo;
    if (updateFactoryDto.currency !== undefined)
      factory.currency = updateFactoryDto.currency;
    if (updateFactoryDto.emailaddress !== undefined)
      factory.emailaddress = updateFactoryDto.emailaddress;

    const savedFactory = await this.factoryRepository.save(factory);
    return this.toDto(savedFactory);
  }

  /**
   * Remove factory (soft delete)
   */
  async remove(id: number): Promise<void> {
    const factory = await this.factoryRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!factory) {
      throw new NotFoundException("Factory not found");
    }

    factory.deleted = 1;
    await this.factoryRepository.save(factory);
  }

  /**
   * Find factory by user ID
   */
  async findByUserId(userId: number): Promise<FactoryDto | null> {
    const factory = await this.factoryRepository.findOne({
      where: { userId, deleted: 0 },
    });
    return factory ? this.toDto(factory) : null;
  }

  /**
   * Find active factories
   */
  async findActiveFactories(): Promise<FactoryDto[]> {
    const factories = await this.factoryRepository.find({
      where: { deleted: 0 },
      order: { city: "ASC" },
    });
    return factories.map((factory) => this.toDto(factory));
  }

  /**
   * Find factories by country
   */
  async findByCountry(country: string): Promise<FactoryDto[]> {
    const factories = await this.factoryRepository
      .createQueryBuilder("factory")
      .where("factory.deleted = 0")
      .andWhere("factory.country ILIKE :country", { country: `%${country}%` })
      .orderBy("factory.city", "ASC")
      .getMany();
    return factories.map((factory) => this.toDto(factory));
  }

  /**
   * Find factories by city
   */
  async findByCity(city: string): Promise<FactoryDto[]> {
    const factories = await this.factoryRepository
      .createQueryBuilder("factory")
      .where("factory.deleted = 0")
      .andWhere("factory.city ILIKE :city", { city: `%${city}%` })
      .getMany();
    return factories.map((factory) => this.toDto(factory));
  }

  /**
   * Get factory count by country
   */
  async getCountByCountry(country: string): Promise<number> {
    return this.factoryRepository
      .createQueryBuilder("factory")
      .where("factory.deleted = 0")
      .andWhere("factory.country ILIKE :country", { country: `%${country}%` })
      .getCount();
  }

  /**
   * Get active factory count
   */
  async getActiveCount(): Promise<number> {
    return this.factoryRepository.count({
      where: { deleted: 0 },
    });
  }

  /**
   * Toggle block status for a factory user.
   * Flips the `blocked` column in the credentials table.
   */
  async toggleBlock(id: number): Promise<{ enabled: boolean }> {
    const factory = await this.factoryRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!factory) {
      throw new NotFoundException("Factory not found");
    }

    if (!factory.userId) {
      throw new NotFoundException("Factory has no linked user account");
    }

    // Toggle blocked in credentials table (blocked=0 means enabled, blocked=1 means blocked)
    await this.dataSource.query(
      `UPDATE credentials SET blocked = CASE WHEN blocked = 0 THEN 1 ELSE 0 END WHERE user_id = $1`,
      [factory.userId],
    );

    // Read back new state
    const result = await this.dataSource.query(
      `SELECT blocked FROM credentials WHERE user_id = $1`,
      [factory.userId],
    );

    return { enabled: result[0]?.blocked === 0 };
  }

  /**
   * Convert entity to DTO
   */
  private toDto(factory: FactoryEntity): FactoryDto {
    const dto = new FactoryDto();
    dto.id = factory.id;
    dto.userId = factory.userId ?? undefined;
    dto.address = factory.address ?? undefined;
    dto.zipcode = factory.zipcode ?? undefined;
    dto.state = factory.state ?? undefined;
    dto.city = factory.city ?? undefined;
    dto.country = factory.country ?? undefined;
    dto.phoneNo = factory.phoneNo ?? undefined;
    dto.cellNo = factory.cellNo ?? undefined;
    dto.currency = factory.currency ?? undefined;
    dto.emailaddress = factory.emailaddress ?? undefined;
    dto.deleted = factory.deleted;
    dto.isActive = factory.deleted === 0;
    dto.fullAddress = factory.fullAddress;
    dto.displayName = factory.displayName;
    dto.createdAt = factory.createdAt;
    dto.updatedAt = factory.updatedAt;
    return dto;
  }
}
