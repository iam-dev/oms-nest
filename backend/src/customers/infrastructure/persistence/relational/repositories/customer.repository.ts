import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CustomerEntity } from "../entities/customer.entity";
import { ICustomerRepository } from "../../../../domain/customer.repository";
import { Customer } from "../../../../domain/customer";
import { CustomerId } from "../../../../domain/value-objects/customer-id.value-object";
import { Email } from "../../../../domain/value-objects/email.value-object";
import { CustomerMapper } from "../mappers/customer.mapper";

/**
 * Customer Repository Implementation
 *
 * Implements the domain repository interface using TypeORM
 * Uses integer IDs to match PostgreSQL schema
 * Uses `deleted` column (smallint) for soft delete instead of deletedAt
 */
@Injectable()
export class CustomerRepository implements ICustomerRepository {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repository: Repository<CustomerEntity>,
    private readonly mapper: CustomerMapper,
  ) {}

  async findById(id: CustomerId): Promise<Customer | null> {
    const numericId = id.numericValue;
    if (numericId === null) {
      return null;
    }

    const entity = await this.repository.findOne({
      where: {
        id: numericId,
        deleted: 0,
      },
    });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByEmail(email: Email, fitterId?: number): Promise<Customer | null> {
    const where: Record<string, unknown> = {
      email: email.value,
      deleted: 0,
    };

    if (fitterId !== undefined) {
      where.fitterId = fitterId;
    }

    const entity = await this.repository.findOne({ where });

    return entity ? this.mapper.toDomain(entity) : null;
  }

  async findByFitterId(fitterId: number): Promise<Customer[]> {
    const entities = await this.repository.find({
      where: {
        fitterId,
        deleted: 0,
      },
      order: {
        name: "ASC",
      },
    });

    return this.mapper.toDomainArray(entities);
  }

  async findByCountry(country: string): Promise<Customer[]> {
    const queryBuilder = this.repository
      .createQueryBuilder("customer")
      .where("customer.deleted = 0")
      .andWhere("customer.country ILIKE :country", {
        country: `%${country}%`,
      })
      .orderBy("customer.name", "ASC");

    const entities = await queryBuilder.getMany();
    return this.mapper.toDomainArray(entities);
  }

  async findByCity(city: string): Promise<Customer[]> {
    const queryBuilder = this.repository
      .createQueryBuilder("customer")
      .where("customer.deleted = 0")
      .andWhere("customer.city ILIKE :city", {
        city: `%${city}%`,
      })
      .orderBy("customer.name", "ASC");

    const entities = await queryBuilder.getMany();
    return this.mapper.toDomainArray(entities);
  }

  async findActive(): Promise<Customer[]> {
    const entities = await this.repository.find({
      where: {
        deleted: 0,
      },
      order: {
        name: "ASC",
      },
    });

    return this.mapper.toDomainArray(entities);
  }

  async save(customer: Customer): Promise<void> {
    const numericId = customer.id.numericValue;

    if (numericId !== null) {
      const existingEntity = await this.repository.findOne({
        where: { id: numericId },
      });

      if (existingEntity) {
        // Update existing entity
        const updatedEntity = this.mapper.updateEntity(
          existingEntity,
          customer,
        );
        await this.repository.save(updatedEntity);
        return;
      }
    }

    // Create new entity (let database auto-generate ID)
    const newEntity = this.mapper.toEntity(customer);
    await this.repository.save(newEntity);
  }

  async delete(id: CustomerId): Promise<void> {
    const numericId = id.numericValue;
    if (numericId !== null) {
      // Soft delete by setting deleted = 1
      await this.repository.update({ id: numericId }, { deleted: 1 });
    }
  }

  async findAll(filters?: {
    fitterId?: number;
    country?: string;
    city?: string;
    isActive?: boolean;
  }): Promise<Customer[]> {
    const queryBuilder = this.repository
      .createQueryBuilder("customer")
      .where("customer.deleted = 0");

    if (filters?.fitterId !== undefined) {
      queryBuilder.andWhere("customer.fitter_id = :fitterId", {
        fitterId: filters.fitterId,
      });
    }

    if (filters?.country) {
      queryBuilder.andWhere("customer.country ILIKE :country", {
        country: `%${filters.country}%`,
      });
    }

    if (filters?.city) {
      queryBuilder.andWhere("customer.city ILIKE :city", {
        city: `%${filters.city}%`,
      });
    }

    queryBuilder.orderBy("customer.name", "ASC");

    const entities = await queryBuilder.getMany();
    return this.mapper.toDomainArray(entities);
  }

  async findAllPaginated(options: {
    page: number;
    limit: number;
    fitterId?: number;
    orderFitterId?: number;
    name?: string;
    email?: string;
    country?: string;
    city?: string;
    search?: string;
    id?: number;
  }): Promise<{ customers: Customer[]; total: number }> {
    const {
      page,
      limit,
      fitterId,
      orderFitterId,
      name,
      email,
      country,
      city,
      search,
      id,
    } = options;

    const queryBuilder = this.repository
      .createQueryBuilder("customer")
      .where("customer.deleted = 0");

    // Exact ID filter
    if (id !== undefined) {
      queryBuilder.andWhere("customer.id = :id", { id });
    }

    // Universal search: match across name, email, city, country, or ID
    if (search) {
      const isNumeric = /^\d+$/.test(search);
      if (isNumeric) {
        queryBuilder.andWhere(
          "(customer.id = :searchId OR customer.name ILIKE :search OR customer.email ILIKE :search OR customer.city ILIKE :search OR customer.country ILIKE :search)",
          { searchId: parseInt(search, 10), search: `%${search}%` },
        );
      } else {
        queryBuilder.andWhere(
          "(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.city ILIKE :search OR customer.country ILIKE :search)",
          { search: `%${search}%` },
        );
      }
    }

    if (fitterId !== undefined) {
      queryBuilder.andWhere("customer.fitter_id = :fitterId", { fitterId });
    }

    if (orderFitterId !== undefined) {
      queryBuilder.andWhere(
        "customer.id IN (SELECT DISTINCT customer_id FROM orders WHERE fitter_id = :orderFitterId AND deleted_at IS NULL)",
        { orderFitterId },
      );
    }

    if (name) {
      queryBuilder.andWhere("customer.name ILIKE :name", {
        name: `%${name}%`,
      });
    }

    if (email) {
      queryBuilder.andWhere("customer.email ILIKE :email", {
        email: `%${email}%`,
      });
    }

    if (country) {
      queryBuilder.andWhere("customer.country ILIKE :country", {
        country: `%${country}%`,
      });
    }

    if (city) {
      queryBuilder.andWhere("customer.city ILIKE :city", {
        city: `%${city}%`,
      });
    }

    queryBuilder.orderBy("customer.id", "DESC");

    const total = await queryBuilder.getCount();
    const entities = await queryBuilder
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      customers: this.mapper.toDomainArray(entities),
      total,
    };
  }

  async countByFitterId(fitterId: number): Promise<number> {
    return this.repository.count({
      where: {
        fitterId,
        deleted: 0,
      },
    });
  }

  async countActive(): Promise<number> {
    return this.repository.count({
      where: {
        deleted: 0,
      },
    });
  }

  async findActiveCustomersWithoutFitter(): Promise<Customer[]> {
    const entities = await this.repository.find({
      where: {
        fitterId: 0,
        deleted: 0,
      },
      order: {
        name: "ASC",
      },
    });

    return this.mapper.toDomainArray(entities);
  }

  async existsByEmail(email: Email, fitterId?: number): Promise<boolean> {
    const where: Record<string, unknown> = {
      email: email.value,
      deleted: 0,
    };

    if (fitterId !== undefined) {
      where.fitterId = fitterId;
    }

    const count = await this.repository.count({ where });
    return count > 0;
  }

  async bulkCreate(customers: Customer[]): Promise<Customer[]> {
    const entities = customers.map((customer) =>
      this.mapper.toEntity(customer),
    );
    const savedEntities = await this.repository.save(entities);
    return this.mapper.toDomainArray(savedEntities);
  }
}
