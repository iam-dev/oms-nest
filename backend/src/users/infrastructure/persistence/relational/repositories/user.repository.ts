import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { InjectDataSource } from "@nestjs/typeorm";

import { Repository, In, SelectQueryBuilder, DataSource } from "typeorm";
import { UserEntity } from "../entities/user.entity";
import { NullableType } from "../../../../../utils/types/nullable.type";
import { FilterUserDto, SortUserDto } from "../../../../dto/query-user.dto";
import { User } from "../../../../domain/user";
import { UserRepository } from "../../user.repository";
import { UserMapper } from "../mappers/user.mapper";
import { IPaginationOptions } from "../../../../../utils/types/pagination-options";

const ALLOWED_SORT_FIELDS = new Set([
  "id",
  "username",
  "email",
  "name",
  "enabled",
  "createdAt",
  "updatedAt",
  "userType",
  "isSupervisor",
  "legacyId",
]);

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  private readonly logger = new Logger(UsersRelationalRepository.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Build a QueryBuilder with shared filter logic for both queries and counts.
   * Role filter translates to DB columns:
   *   supervisor  → is_supervisor = 1
   *   admin       → user_type = 2 AND (is_supervisor IS NULL OR is_supervisor != 1)
   *   fitter      → user_type = 1
   *   factory     → user_type = 3
   *   customsaddler → user_type = 4
   */
  private buildFilteredQuery(
    filterOptions?: FilterUserDto | null,
  ): SelectQueryBuilder<UserEntity> {
    const qb = this.usersRepository.createQueryBuilder("user");

    if (filterOptions?.username) {
      qb.andWhere("user.username ILIKE :username", {
        username: `%${filterOptions.username}%`,
      });
    }
    if (filterOptions?.email) {
      qb.andWhere("user.email ILIKE :email", {
        email: `%${filterOptions.email}%`,
      });
    }
    if (filterOptions?.firstName) {
      qb.andWhere("user.name ILIKE :name", {
        name: `%${filterOptions.firstName}%`,
      });
    }

    // Multi-field search: matches username, name, or email
    if (filterOptions?.search) {
      qb.andWhere(
        "(user.username ILIKE :search OR user.name ILIKE :search OR user.email ILIKE :search)",
        { search: `%${filterOptions.search}%` },
      );
    }

    if (filterOptions?.role) {
      const normalizedRole = filterOptions.role
        .toLowerCase()
        .replace("role_", "");
      switch (normalizedRole) {
        case "supervisor":
          qb.andWhere("user.is_supervisor = :sv", { sv: 1 });
          break;
        case "admin":
        case "administrator":
          qb.andWhere("user.user_type = :ut", { ut: 2 });
          qb.andWhere(
            "(user.is_supervisor IS NULL OR user.is_supervisor != :sv)",
            { sv: 1 },
          );
          break;
        case "fitter":
          qb.andWhere("user.user_type = :ut", { ut: 1 });
          break;
        case "factory":
        case "supplier":
          qb.andWhere("user.user_type = :ut", { ut: 3 });
          break;
        case "customsaddler":
          qb.andWhere("user.user_type = :ut", { ut: 4 });
          break;
        case "user":
          // Users with no user_type and not in fitters table
          qb.andWhere("user.user_type IS NULL");
          qb.andWhere(
            "(user.is_supervisor IS NULL OR user.is_supervisor != :sv)",
            { sv: 1 },
          );
          break;
      }
    }

    return qb;
  }

  async create(data: User): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data);
    const newEntity = await this.usersRepository.save(
      this.usersRepository.create(persistenceModel),
    );
    return UserMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    const qb = this.buildFilteredQuery(filterOptions);

    qb.skip((paginationOptions.page - 1) * paginationOptions.limit);
    qb.take(paginationOptions.limit);

    if (sortOptions?.length) {
      for (const sort of sortOptions) {
        const field = sort.field ?? (sort.orderBy as string);
        if (field && ALLOWED_SORT_FIELDS.has(field)) {
          const direction = (
            sort.direction ??
            sort.order ??
            "asc"
          ).toUpperCase() as "ASC" | "DESC";
          qb.addOrderBy(`user.${field}`, direction);
        } else {
          this.logger.warn(`Ignored invalid sort field: ${field}`);
        }
      }
    }

    this.logger.debug(`findManyWithPagination query: ${qb.getSql()}`);

    const entities = await qb.getMany();
    return entities.map((user) => UserMapper.toDomain(user));
  }

  async count(filterOptions?: FilterUserDto | null): Promise<number> {
    const qb = this.buildFilteredQuery(filterOptions);
    return qb.getCount();
  }

  async findById(id: User["id"]): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id: id },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User["id"][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User["email"]): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email },
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByEmailOrUsername(
    emailOrUsername: string,
  ): Promise<NullableType<User>> {
    if (!emailOrUsername) return null;

    const entity = await this.usersRepository.findOne({
      where: [{ email: emailOrUsername }, { username: emailOrUsername }],
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findBySocialIdAndProvider({
    socialId: _socialId,
    provider: _provider,
  }: {
    socialId: string;
    provider: string;
  }): Promise<NullableType<User>> {
    await Promise.resolve();
    void _socialId;
    void _provider;
    // Social login not supported in staging schema
    return null;
  }

  async update(id: User["id"], payload: Partial<User>): Promise<User> {
    // The "user" entity maps to a PostgreSQL VIEW on the "credentials" table.
    // Views are not directly updatable, so we update credentials via raw SQL.
    const entity = await this.usersRepository.findOne({
      where: { id: id as unknown as number },
    });

    if (!entity) {
      throw new Error("User not found");
    }

    const legacyId = entity.legacyId;
    if (!legacyId) {
      throw new Error("User has no legacy_id, cannot update credentials");
    }

    // Build SET clauses mapping domain fields to credentials columns
    const setClauses: string[] = [];
    const params: (string | number)[] = [];
    let paramIndex = 1;

    if (payload.username !== undefined) {
      setClauses.push(`user_name = $${paramIndex++}`);
      params.push(payload.username);
    }

    if (payload.password !== undefined) {
      setClauses.push(`password_hash = $${paramIndex++}`);
      params.push(payload.password);
    }

    if (payload.name !== undefined) {
      setClauses.push(`full_name = $${paramIndex++}`);
      params.push(payload.name);
    }

    if (payload.enabled !== undefined) {
      setClauses.push(`blocked = $${paramIndex++}`);
      params.push(payload.enabled ? 0 : 1);
    }

    if (setClauses.length > 0) {
      params.push(legacyId);
      const query = `UPDATE credentials SET ${setClauses.join(", ")} WHERE user_id = $${paramIndex}`;
      this.logger.log(
        `Updating credentials for legacy_id=${legacyId}: ${setClauses.join(", ")}`,
      );
      await this.dataSource.query(query, params);
    }

    // Re-read the updated user from the view
    const updatedEntity = await this.usersRepository.findOne({
      where: { id: id as unknown as number },
    });

    if (!updatedEntity) {
      throw new Error("User not found after update");
    }

    return UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User["id"]): Promise<void> {
    await this.usersRepository.softDelete(id);
  }
}
