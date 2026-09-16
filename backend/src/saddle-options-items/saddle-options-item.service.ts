import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { SaddleOptionsItemEntity } from "./infrastructure/persistence/relational/entities/saddle-options-item.entity";
import { CreateSaddleOptionsItemDto } from "./dto/create-saddle-options-item.dto";
import { UpdateSaddleOptionsItemDto } from "./dto/update-saddle-options-item.dto";
import { SaddleOptionsItemDto } from "./dto/saddle-options-item.dto";

/**
 * SaddleOptionsItem Service
 *
 * Manages saddle option item configurations.
 */
@Injectable()
export class SaddleOptionsItemService {
  constructor(
    @InjectRepository(SaddleOptionsItemEntity)
    private readonly repository: Repository<SaddleOptionsItemEntity>,
  ) {}

  /**
   * Create a new saddle-options-item association
   */
  async create(
    createDto: CreateSaddleOptionsItemDto,
  ): Promise<SaddleOptionsItemDto> {
    // Check for existing association (active or soft-deleted). Legacy OMS
    // soft-deletes these rows, so re-enabling revives the row rather than
    // inserting a duplicate.
    const existing = await this.repository.findOne({
      where: {
        saddleId: createDto.saddleId,
        optionId: createDto.optionId,
        optionItemId: createDto.optionItemId,
        leatherId: createDto.leatherId,
      },
    });

    if (existing && existing.deleted === 0) {
      throw new ConflictException(
        "Saddle-option-item association already exists",
      );
    }

    if (existing) {
      existing.deleted = 0;
      if (createDto.sequence !== undefined) {
        existing.sequence = createDto.sequence;
      }
      const revived = await this.repository.save(existing);
      return this.toDto(revived);
    }

    const entity = this.repository.create({
      saddleId: createDto.saddleId,
      optionId: createDto.optionId,
      optionItemId: createDto.optionItemId,
      leatherId: createDto.leatherId,
      sequence: createDto.sequence ?? 0,
      deleted: 0,
    });

    const saved = await this.repository.save(entity);
    return this.toDto(saved);
  }

  /**
   * Find by ID
   */
  async findOne(id: number): Promise<SaddleOptionsItemDto> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });

    if (!entity) {
      throw new NotFoundException("Saddle-options-item association not found");
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
    optionId?: number,
  ): Promise<{ data: SaddleOptionsItemDto[]; total: number; pages: number }> {
    const queryBuilder = this.repository
      .createQueryBuilder("soi")
      .where("soi.deleted = 0");

    if (saddleId !== undefined) {
      queryBuilder.andWhere("soi.saddle_id = :saddleId", { saddleId });
    }

    if (optionId !== undefined) {
      queryBuilder.andWhere("soi.option_id = :optionId", { optionId });
    }

    queryBuilder.orderBy("soi.sequence", "ASC");

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
   * Find by saddle ID
   */
  async findBySaddleId(saddleId: number): Promise<SaddleOptionsItemDto[]> {
    const items = await this.repository.find({
      where: { saddleId, deleted: 0 },
      order: { sequence: "ASC" },
    });

    return items.map((item) => this.toDto(item));
  }

  /**
   * Find by option ID
   */
  async findByOptionId(optionId: number): Promise<SaddleOptionsItemDto[]> {
    const items = await this.repository.find({
      where: { optionId, deleted: 0 },
      order: { sequence: "ASC" },
    });

    return items.map((item) => this.toDto(item));
  }

  /**
   * Find by saddle and option
   */
  async findBySaddleAndOption(
    saddleId: number,
    optionId: number,
  ): Promise<SaddleOptionsItemDto[]> {
    const items = await this.repository.find({
      where: { saddleId, optionId, deleted: 0 },
      order: { sequence: "ASC" },
    });

    return items.map((item) => this.toDto(item));
  }

  /**
   * Update
   */
  async update(
    id: number,
    updateDto: UpdateSaddleOptionsItemDto,
  ): Promise<SaddleOptionsItemDto> {
    const entity = await this.repository.findOne({
      where: { id, deleted: 0 },
    });

    if (!entity) {
      throw new NotFoundException("Saddle-options-item association not found");
    }

    // Update fields
    if (updateDto.saddleId !== undefined) entity.saddleId = updateDto.saddleId;
    if (updateDto.optionId !== undefined) entity.optionId = updateDto.optionId;
    if (updateDto.optionItemId !== undefined)
      entity.optionItemId = updateDto.optionItemId;
    if (updateDto.leatherId !== undefined)
      entity.leatherId = updateDto.leatherId;
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
      throw new NotFoundException("Saddle-options-item association not found");
    }

    entity.deleted = 1;
    await this.repository.save(entity);
  }

  /**
   * Bulk create for a saddle
   */
  async bulkCreateForSaddle(
    saddleId: number,
    items: Omit<CreateSaddleOptionsItemDto, "saddleId">[],
  ): Promise<SaddleOptionsItemDto[]> {
    const entities = items.map((item) =>
      this.repository.create({
        saddleId,
        optionId: item.optionId,
        optionItemId: item.optionItemId,
        leatherId: item.leatherId,
        sequence: item.sequence ?? 0,
        deleted: 0,
      }),
    );

    const saved = await this.repository.save(entities);
    return saved.map((entity) => this.toDto(entity));
  }

  /**
   * Convert entity to DTO
   */
  private toDto(entity: SaddleOptionsItemEntity): SaddleOptionsItemDto {
    const dto = new SaddleOptionsItemDto();
    dto.id = entity.id;
    dto.saddleId = entity.saddleId;
    dto.optionId = entity.optionId;
    dto.optionItemId = entity.optionItemId;
    dto.leatherId = entity.leatherId;
    dto.sequence = entity.sequence;
    dto.deleted = entity.deleted;
    dto.isActive = entity.deleted === 0;
    return dto;
  }
}
