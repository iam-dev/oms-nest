import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Like, FindOptionsWhere } from "typeorm";
import { WarehouseEntity } from "./infrastructure/persistence/relational/entities/warehouse.entity";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { QueryWarehouseDto } from "./dto/query-warehouse.dto";

@Injectable()
export class WarehouseService {
  constructor(
    @InjectRepository(WarehouseEntity)
    private readonly warehouseRepository: Repository<WarehouseEntity>,
  ) {}

  async create(
    createWarehouseDto: CreateWarehouseDto,
  ): Promise<WarehouseEntity> {
    const warehouse = this.warehouseRepository.create(createWarehouseDto);
    return this.warehouseRepository.save(warehouse);
  }

  async findAll(query: QueryWarehouseDto) {
    const {
      name,
      city,
      country,
      is_active,
      page = 1,
      limit = 20,
      sortBy = "name",
      sortOrder = "ASC",
    } = query;

    const where: FindOptionsWhere<WarehouseEntity> = {};

    if (name) {
      where.name = Like(`%${name}%`);
    }
    if (city) {
      where.city = Like(`%${city}%`);
    }
    if (country) {
      where.country = Like(`%${country}%`);
    }
    if (is_active !== undefined) {
      where.isActive = is_active;
    }

    const [data, total] = await this.warehouseRepository.findAndCount({
      where,
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string): Promise<WarehouseEntity> {
    const warehouse = await this.warehouseRepository.findOne({ where: { id } });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return warehouse;
  }

  async update(
    id: string,
    updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<WarehouseEntity> {
    const warehouse = await this.findOne(id);
    Object.assign(warehouse, updateWarehouseDto);
    return this.warehouseRepository.save(warehouse);
  }

  async remove(id: string): Promise<void> {
    const warehouse = await this.findOne(id);
    await this.warehouseRepository.softRemove(warehouse);
  }

  async restore(id: string): Promise<WarehouseEntity> {
    const warehouse = await this.warehouseRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!warehouse) {
      throw new NotFoundException(`Warehouse with ID ${id} not found`);
    }
    return this.warehouseRepository.recover(warehouse);
  }
}
