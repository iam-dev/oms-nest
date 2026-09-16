import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { LeathertypeEntity } from "./infrastructure/persistence/relational/entities/leathertype.entity";
import { CreateLeathertypeDto } from "./dto/create-leathertype.dto";
import { UpdateLeathertypeDto } from "./dto/update-leathertype.dto";
import { LeathertypeDto } from "./dto/leathertype.dto";

/**
 * Leathertype Service
 *
 * Manages leathertype operations with simplified schema.
 * Uses integer IDs to match PostgreSQL schema.
 */
@Injectable()
export class LeathertypeService {
  constructor(
    @InjectRepository(LeathertypeEntity)
    private readonly leathertypeRepository: Repository<LeathertypeEntity>,
  ) {}

  /**
   * Create a new leathertype
   */
  async create(
    createLeathertypeDto: CreateLeathertypeDto,
  ): Promise<LeathertypeDto> {
    // Check if leathertype with this name already exists
    const existingLeathertype = await this.leathertypeRepository.findOne({
      where: { name: createLeathertypeDto.name, deleted: 0 },
    });

    if (existingLeathertype) {
      throw new ConflictException("Leathertype with this name already exists");
    }

    const leathertype = this.leathertypeRepository.create({
      name: createLeathertypeDto.name,
      sequence: createLeathertypeDto.sequence ?? 0,
      deleted: 0,
    });
    const savedLeathertype = await this.leathertypeRepository.save(leathertype);

    return this.toDto(savedLeathertype);
  }

  /**
   * Find leathertype by ID
   */
  async findOne(id: number): Promise<LeathertypeDto> {
    const leathertype = await this.leathertypeRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!leathertype) {
      throw new NotFoundException("Leathertype not found");
    }

    return this.toDto(leathertype);
  }

  /**
   * Find all leathertypes with filtering and pagination
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    includeDeleted = false,
  ): Promise<{ data: LeathertypeDto[]; total: number; pages: number }> {
    // Legacy option items may still reference soft-deleted leathertypes; the
    // admin UI can ask for them so it can label those references by name.
    const queryBuilder = this.leathertypeRepository
      .createQueryBuilder("leathertype")
      .where(includeDeleted ? "1 = 1" : "leathertype.deleted = 0");

    if (search) {
      queryBuilder.andWhere("leathertype.name ILIKE :search", {
        search: `%${search}%`,
      });
    }

    queryBuilder
      .orderBy("leathertype.sequence", "ASC")
      .addOrderBy("leathertype.name", "ASC");

    const total = await queryBuilder.getCount();
    const leathertypes = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: leathertypes.map((leathertype) => this.toDto(leathertype)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Update leathertype
   */
  async update(
    id: number,
    updateLeathertypeDto: UpdateLeathertypeDto,
  ): Promise<LeathertypeDto> {
    const leathertype = await this.leathertypeRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!leathertype) {
      throw new NotFoundException("Leathertype not found");
    }

    // Check for name conflicts if name is being changed
    if (
      updateLeathertypeDto.name &&
      updateLeathertypeDto.name !== leathertype.name
    ) {
      const existingLeathertype = await this.leathertypeRepository.findOne({
        where: { name: updateLeathertypeDto.name, deleted: 0 },
      });
      if (existingLeathertype && existingLeathertype.id !== leathertype.id) {
        throw new ConflictException(
          "Leathertype with this name already exists",
        );
      }
    }

    // Update fields that are provided
    if (updateLeathertypeDto.name !== undefined)
      leathertype.name = updateLeathertypeDto.name;
    if (updateLeathertypeDto.sequence !== undefined)
      leathertype.sequence = updateLeathertypeDto.sequence;

    const savedLeathertype = await this.leathertypeRepository.save(leathertype);

    return this.toDto(savedLeathertype);
  }

  /**
   * Remove leathertype (soft delete)
   */
  async remove(id: number): Promise<void> {
    const leathertype = await this.leathertypeRepository.findOne({
      where: { id, deleted: 0 },
    });

    if (!leathertype) {
      throw new NotFoundException("Leathertype not found");
    }

    leathertype.deleted = 1;
    await this.leathertypeRepository.save(leathertype);
  }

  /**
   * Get active leathertypes only
   */
  async findActiveLeathertypes(): Promise<LeathertypeDto[]> {
    const leathertypes = await this.leathertypeRepository.find({
      where: { deleted: 0 },
      order: { sequence: "ASC", name: "ASC" },
    });

    return leathertypes.map((leathertype) => this.toDto(leathertype));
  }

  /**
   * Convert entity to DTO
   */
  private toDto(leathertype: LeathertypeEntity): LeathertypeDto {
    const dto = new LeathertypeDto();
    dto.id = leathertype.id;
    dto.name = leathertype.name;
    dto.sequence = leathertype.sequence;
    dto.deleted = leathertype.deleted;
    dto.isActive = leathertype.deleted === 0;
    dto.displayName = leathertype.name;
    return dto;
  }
}
