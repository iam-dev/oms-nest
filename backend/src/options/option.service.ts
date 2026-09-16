import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { OptionEntity } from "./infrastructure/persistence/relational/entities/option.entity";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import { OptionDto } from "./dto/option.dto";

/**
 * Option Service
 *
 * Manages option operations with 7-tier pricing structure.
 * Uses integer IDs to match PostgreSQL schema.
 */
@Injectable()
export class OptionService {
  constructor(
    @InjectRepository(OptionEntity)
    private readonly optionRepository: Repository<OptionEntity>,
  ) {}

  /**
   * Create a new option
   */
  async create(createOptionDto: CreateOptionDto): Promise<OptionDto> {
    // Check if option with this name already exists
    const existingOption = await this.optionRepository.findOne({
      where: { name: createOptionDto.name, deleted: 0 },
    });

    if (existingOption) {
      throw new ConflictException("Option with this name already exists");
    }

    // Map DTO to entity with proper field mapping
    const option = this.optionRepository.create({
      name: createOptionDto.name,
      group: createOptionDto.group,
      type: createOptionDto.type ?? 0,
      price1: createOptionDto.price1 ?? 0,
      price2: createOptionDto.price2 ?? 0,
      price3: createOptionDto.price3 ?? 0,
      price4: createOptionDto.price4 ?? 0,
      price5: createOptionDto.price5 ?? 0,
      price6: createOptionDto.price6 ?? 0,
      price7: createOptionDto.price7 ?? 0,
      priceContrast1: createOptionDto.priceContrast1 ?? 0,
      priceContrast2: createOptionDto.priceContrast2 ?? 0,
      priceContrast3: createOptionDto.priceContrast3 ?? 0,
      priceContrast4: createOptionDto.priceContrast4 ?? 0,
      priceContrast5: createOptionDto.priceContrast5 ?? 0,
      priceContrast6: createOptionDto.priceContrast6 ?? 0,
      priceContrast7: createOptionDto.priceContrast7 ?? 0,
      sequence: createOptionDto.sequence ?? 0,
      extraAllowed: createOptionDto.extraAllowed ?? 0,
      deleted: 0,
    });

    const savedOption = await this.optionRepository.save(option);

    return this.toDto(savedOption);
  }

  /**
   * Find option by ID
   */
  async findOne(id: number): Promise<OptionDto> {
    const option = await this.optionRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!option) {
      throw new NotFoundException("Option not found");
    }

    return this.toDto(option);
  }

  /**
   * Find all options with filtering and pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    group?: string,
    type?: number,
    excludeType?: number,
  ): Promise<{ data: OptionDto[]; total: number; pages: number }> {
    const queryBuilder = this.optionRepository
      .createQueryBuilder("option")
      .where("option.deleted = 0");

    if (search) {
      queryBuilder.andWhere("option.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    if (group) {
      queryBuilder.andWhere("option.group = :group", { group });
    }

    if (type !== undefined) {
      queryBuilder.andWhere("option.type = :type", { type });
    }

    // Extras live in this table as type = 2; the Options admin page excludes them
    if (excludeType !== undefined) {
      queryBuilder.andWhere("option.type <> :excludeType", { excludeType });
    }

    queryBuilder
      .orderBy("option.sequence", "ASC")
      .addOrderBy("option.name", "ASC");

    const total = await queryBuilder.getCount();
    const options = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: options.map((option) => this.toDto(option)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update option
   */
  async update(
    id: number,
    updateOptionDto: UpdateOptionDto,
  ): Promise<OptionDto> {
    const option = await this.optionRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!option) {
      throw new NotFoundException("Option not found");
    }

    // Check for name conflicts if name is being changed
    if (updateOptionDto.name && updateOptionDto.name !== option.name) {
      const existingOption = await this.optionRepository.findOne({
        where: { name: updateOptionDto.name, deleted: 0 },
      });
      if (existingOption && existingOption.id !== option.id) {
        throw new ConflictException("Option with this name already exists");
      }
    }

    // Update fields that are provided
    if (updateOptionDto.name !== undefined) option.name = updateOptionDto.name;
    if (updateOptionDto.group !== undefined)
      option.group = updateOptionDto.group;
    if (updateOptionDto.type !== undefined) option.type = updateOptionDto.type;
    if (updateOptionDto.price1 !== undefined)
      option.price1 = updateOptionDto.price1;
    if (updateOptionDto.price2 !== undefined)
      option.price2 = updateOptionDto.price2;
    if (updateOptionDto.price3 !== undefined)
      option.price3 = updateOptionDto.price3;
    if (updateOptionDto.price4 !== undefined)
      option.price4 = updateOptionDto.price4;
    if (updateOptionDto.price5 !== undefined)
      option.price5 = updateOptionDto.price5;
    if (updateOptionDto.price6 !== undefined)
      option.price6 = updateOptionDto.price6;
    if (updateOptionDto.price7 !== undefined)
      option.price7 = updateOptionDto.price7;
    if (updateOptionDto.priceContrast1 !== undefined)
      option.priceContrast1 = updateOptionDto.priceContrast1;
    if (updateOptionDto.priceContrast2 !== undefined)
      option.priceContrast2 = updateOptionDto.priceContrast2;
    if (updateOptionDto.priceContrast3 !== undefined)
      option.priceContrast3 = updateOptionDto.priceContrast3;
    if (updateOptionDto.priceContrast4 !== undefined)
      option.priceContrast4 = updateOptionDto.priceContrast4;
    if (updateOptionDto.priceContrast5 !== undefined)
      option.priceContrast5 = updateOptionDto.priceContrast5;
    if (updateOptionDto.priceContrast6 !== undefined)
      option.priceContrast6 = updateOptionDto.priceContrast6;
    if (updateOptionDto.priceContrast7 !== undefined)
      option.priceContrast7 = updateOptionDto.priceContrast7;
    if (updateOptionDto.sequence !== undefined)
      option.sequence = updateOptionDto.sequence;
    if (updateOptionDto.extraAllowed !== undefined)
      option.extraAllowed = updateOptionDto.extraAllowed;

    const savedOption = await this.optionRepository.save(option);

    return this.toDto(savedOption);
  }

  /**
   * Remove option (soft delete)
   */
  async remove(id: number): Promise<void> {
    const option = await this.optionRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!option) {
      throw new NotFoundException("Option not found");
    }

    option.deleted = 1;
    await this.optionRepository.save(option);
  }

  /**
   * Get active options only
   */
  async findActiveOptions(): Promise<OptionDto[]> {
    const options = await this.optionRepository.find({
      where: { deleted: 0 },
      order: { sequence: "ASC", name: "ASC" },
    });

    return options.map((option) => this.toDto(option));
  }

  /**
   * Get options by group
   */
  async findByGroup(group: string): Promise<OptionDto[]> {
    const options = await this.optionRepository.find({
      where: { group, deleted: 0 },
      order: { sequence: "ASC", name: "ASC" },
    });

    return options.map((option) => this.toDto(option));
  }

  /**
   * Get options by type
   */
  async findByType(type: number): Promise<OptionDto[]> {
    const options = await this.optionRepository.find({
      where: { type, deleted: 0 },
      order: { sequence: "ASC", name: "ASC" },
    });

    return options.map((option) => this.toDto(option));
  }

  /**
   * Convert entity to DTO
   */
  private toDto(option: OptionEntity): OptionDto {
    const dto = new OptionDto();
    dto.id = option.id;
    dto.name = option.name;
    dto.group = option.group;
    dto.type = option.type;
    dto.price1 = option.price1;
    dto.price2 = option.price2;
    dto.price3 = option.price3;
    dto.price4 = option.price4;
    dto.price5 = option.price5;
    dto.price6 = option.price6;
    dto.price7 = option.price7;
    dto.priceContrast1 = option.priceContrast1;
    dto.priceContrast2 = option.priceContrast2;
    dto.priceContrast3 = option.priceContrast3;
    dto.priceContrast4 = option.priceContrast4;
    dto.priceContrast5 = option.priceContrast5;
    dto.priceContrast6 = option.priceContrast6;
    dto.priceContrast7 = option.priceContrast7;
    dto.sequence = option.sequence;
    dto.extraAllowed = option.extraAllowed;
    dto.deleted = option.deleted;
    dto.isActive = option.deleted === 0;
    return dto;
  }
}
