import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SaddleLeatherEntity } from "./infrastructure/persistence/relational/entities/saddle-leather.entity";
import { CreateSaddleLeatherDto } from "./dto/create-saddle-leather.dto";
import { UpdateSaddleLeatherDto } from "./dto/update-saddle-leather.dto";
import { SaddleLeatherDto } from "./dto/saddle-leather.dto";

/**
 * SaddleLeather Service
 *
 * Manages saddle-leather associations with 7-tier pricing structure.
 */
@Injectable()
export class SaddleLeatherService {
  constructor(
    @InjectRepository(SaddleLeatherEntity)
    private readonly repository: Repository<SaddleLeatherEntity>,
  ) {}

  /**
   * Create a new saddle-leather association.
   *
   * Legacy OMS never hard-deletes these rows: unchecking a leather on a saddle
   * only flags it `deleted = 1` and keeps its prices. Re-enabling therefore
   * revives the existing row (prices intact) instead of inserting a zero-priced
   * duplicate. Prices passed in the DTO override the stored ones.
   */
  async create(createDto: CreateSaddleLeatherDto): Promise<SaddleLeatherDto> {
    // Check for existing association (active or soft-deleted)
    const existing = await this.repository.findOne({
      where: {
        saddleId: createDto.saddleId,
        leatherId: createDto.leatherId,
      },
    });

    if (existing && existing.deleted === 0) {
      throw new ConflictException("Saddle-leather association already exists");
    }

    if (existing) {
      existing.deleted = 0;
      for (const tier of [1, 2, 3, 4, 5, 6, 7] as const) {
        const key = `price${tier}` as const;
        if (createDto[key] !== undefined) {
          existing[key] = createDto[key];
        }
      }
      if (createDto.sequence !== undefined) {
        existing.sequence = createDto.sequence;
      }
      const revived = await this.repository.save(existing);
      return this.toDto(revived);
    }

    const entity = this.repository.create({
      saddleId: createDto.saddleId,
      leatherId: createDto.leatherId,
      price1: createDto.price1 ?? 0,
      price2: createDto.price2 ?? 0,
      price3: createDto.price3 ?? 0,
      price4: createDto.price4 ?? 0,
      price5: createDto.price5 ?? 0,
      price6: createDto.price6 ?? 0,
      price7: createDto.price7 ?? 0,
      sequence: createDto.sequence ?? 0,
      deleted: 0,
    });

    const saved = await this.repository.save(entity);
    return this.toDto(saved);
  }

  /**
   * Find by ID
   */
  async findOne(id: number): Promise<SaddleLeatherDto> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });

    if (!entity) {
      throw new NotFoundException("Saddle-leather association not found");
    }

    return this.toDto(entity);
  }

  /**
   * Find all with pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    saddleId?: number,
    leatherId?: number,
  ): Promise<{ data: SaddleLeatherDto[]; total: number; pages: number }> {
    const queryBuilder = this.repository
      .createQueryBuilder("sl")
      .where("sl.deleted = 0");

    if (saddleId !== undefined) {
      queryBuilder.andWhere("sl.saddle_id = :saddleId", { saddleId });
    }

    if (leatherId !== undefined) {
      queryBuilder.andWhere("sl.leather_id = :leatherId", { leatherId });
    }

    queryBuilder.orderBy("sl.sequence", "ASC");

    const total = await queryBuilder.getCount();
    const items = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: items.map((item) => this.toDto(item)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Find by saddle ID.
   *
   * `includeDeleted` also returns soft-deleted rows so the admin UI can show the
   * (still stored) prices of leathers that are currently disabled for a saddle.
   */
  async findBySaddleId(
    saddleId: number,
    includeDeleted = false,
  ): Promise<SaddleLeatherDto[]> {
    const items = await this.repository.find({
      where: includeDeleted ? { saddleId } : { saddleId, deleted: 0 },
      order: { sequence: "ASC" },
    });

    return items.map((item) => this.toDto(item));
  }

  /**
   * Find by leather ID
   */
  async findByLeatherId(leatherId: number): Promise<SaddleLeatherDto[]> {
    const items = await this.repository.find({
      where: { leatherId, deleted: 0 },
      order: { sequence: "ASC" },
    });

    return items.map((item) => this.toDto(item));
  }

  /**
   * Update
   */
  async update(
    id: number,
    updateDto: UpdateSaddleLeatherDto,
  ): Promise<SaddleLeatherDto> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });

    if (!entity) {
      throw new NotFoundException("Saddle-leather association not found");
    }

    // Update fields
    if (updateDto.saddleId !== undefined) entity.saddleId = updateDto.saddleId;
    if (updateDto.leatherId !== undefined)
      entity.leatherId = updateDto.leatherId;
    if (updateDto.price1 !== undefined) entity.price1 = updateDto.price1;
    if (updateDto.price2 !== undefined) entity.price2 = updateDto.price2;
    if (updateDto.price3 !== undefined) entity.price3 = updateDto.price3;
    if (updateDto.price4 !== undefined) entity.price4 = updateDto.price4;
    if (updateDto.price5 !== undefined) entity.price5 = updateDto.price5;
    if (updateDto.price6 !== undefined) entity.price6 = updateDto.price6;
    if (updateDto.price7 !== undefined) entity.price7 = updateDto.price7;
    if (updateDto.sequence !== undefined) entity.sequence = updateDto.sequence;

    const saved = await this.repository.save(entity);
    return this.toDto(saved);
  }

  /**
   * Remove (soft delete)
   */
  async remove(id: number): Promise<void> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });

    if (!entity) {
      throw new NotFoundException("Saddle-leather association not found");
    }

    entity.deleted = 1;
    await this.repository.save(entity);
  }

  /**
   * Convert entity to DTO
   */
  private toDto(entity: SaddleLeatherEntity): SaddleLeatherDto {
    const dto = new SaddleLeatherDto();
    dto.id = entity.id;
    dto.saddleId = entity.saddleId;
    dto.leatherId = entity.leatherId;
    dto.price1 = entity.price1;
    dto.price2 = entity.price2;
    dto.price3 = entity.price3;
    dto.price4 = entity.price4;
    dto.price5 = entity.price5;
    dto.price6 = entity.price6;
    dto.price7 = entity.price7;
    dto.sequence = entity.sequence;
    dto.deleted = entity.deleted;
    dto.isActive = entity.deleted === 0;
    return dto;
  }
}
