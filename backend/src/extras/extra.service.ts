import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { IExtraRepository } from "./domain/extra.repository";
import { Extra } from "./domain/extra";
import { ExtraId } from "./domain/value-objects/extra-id.value-object";
import { CreateExtraDto } from "./dto/create-extra.dto";
import { UpdateExtraDto } from "./dto/update-extra.dto";
import { ExtraDto } from "./dto/extra.dto";

/**
 * Extra Application Service
 *
 * Orchestrates extra domain operations.
 * Uses domain repository abstraction instead of TypeORM directly.
 */
@Injectable()
export class ExtraService {
  constructor(private readonly extraRepository: IExtraRepository) {}

  async create(createExtraDto: CreateExtraDto): Promise<ExtraDto> {
    const existing = await this.extraRepository.findByName(createExtraDto.name);
    if (existing) {
      throw new ConflictException("Extra with this name already exists");
    }

    const extra = Extra.create(
      ExtraId.generate(),
      createExtraDto.name,
      createExtraDto.description,
      createExtraDto.price1 ?? 0,
      createExtraDto.price2 ?? 0,
      createExtraDto.price3 ?? 0,
      createExtraDto.price4 ?? 0,
      createExtraDto.price5 ?? 0,
      createExtraDto.price6 ?? 0,
      createExtraDto.price7 ?? 0,
      createExtraDto.sequence ?? 0,
    );

    const savedExtra = await this.extraRepository.save(extra);
    return this.toDto(savedExtra);
  }

  async findOne(id: string): Promise<ExtraDto> {
    const extra = await this.extraRepository.findById(ExtraId.fromString(id));
    if (!extra) {
      throw new NotFoundException("Extra not found");
    }
    return this.toDto(extra);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{ data: ExtraDto[]; total: number; pages: number }> {
    const { extras, total } = await this.extraRepository.findAll({
      page,
      limit,
      search,
    });

    return {
      data: extras.map((extra) => this.toDto(extra)),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  async update(id: string, updateExtraDto: UpdateExtraDto): Promise<ExtraDto> {
    const extra = await this.extraRepository.findById(ExtraId.fromString(id));
    if (!extra) {
      throw new NotFoundException("Extra not found");
    }

    if (updateExtraDto.name && updateExtraDto.name !== extra.name) {
      const existing = await this.extraRepository.findByName(
        updateExtraDto.name,
      );
      if (existing && existing.id.value !== extra.id.value) {
        throw new ConflictException("Extra with this name already exists");
      }
    }

    extra.updateInfo(
      updateExtraDto.name,
      updateExtraDto.description,
      updateExtraDto.price1,
      updateExtraDto.price2,
      updateExtraDto.price3,
      updateExtraDto.price4,
      updateExtraDto.price5,
      updateExtraDto.price6,
      updateExtraDto.price7,
      updateExtraDto.sequence,
    );

    const savedExtra = await this.extraRepository.save(extra);
    return this.toDto(savedExtra);
  }

  async remove(id: string): Promise<void> {
    const extra = await this.extraRepository.findById(ExtraId.fromString(id));
    if (!extra) {
      throw new NotFoundException("Extra not found");
    }
    await this.extraRepository.softDelete(ExtraId.fromString(id));
  }

  async findActiveExtras(): Promise<ExtraDto[]> {
    const extras = await this.extraRepository.findActive();
    return extras.map((extra) => this.toDto(extra));
  }

  private toDto(extra: Extra): ExtraDto {
    const dto = new ExtraDto();
    dto.id = extra.id.value;
    dto.name = extra.name;
    dto.description = extra.description ?? undefined;
    dto.price1 = extra.price1;
    dto.price2 = extra.price2;
    dto.price3 = extra.price3;
    dto.price4 = extra.price4;
    dto.price5 = extra.price5;
    dto.price6 = extra.price6;
    dto.price7 = extra.price7;
    dto.sequence = extra.sequence;
    dto.createdAt = extra.createdAt;
    dto.updatedAt = extra.updatedAt;
    dto.deletedAt = extra.deletedAt;
    dto.isActive = extra.isActive();
    dto.displayName = extra.name;
    return dto;
  }
}
