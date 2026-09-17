import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import ms from "ms";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { FactoryEntity } from "./infrastructure/persistence/relational/entities/factory.entity";
import { CreateFactoryDto } from "./dto/create-factory.dto";
import { UpdateFactoryDto } from "./dto/update-factory.dto";
import { FactoryDto } from "./dto/factory.dto";
import { MailService } from "../mail/mail.service";
import { AllConfigType } from "../config/config.type";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Factory Application Service
 *
 * Manages factory operations with simplified schema.
 * Uses integer IDs to match PostgreSQL schema.
 *
 * A factory row only holds address data; name, username and blocked state
 * live on the linked login account (`credentials`, exposed via the "user"
 * view), so those fields are read and written through raw queries.
 */
@Injectable()
export class FactoryService {
  private readonly logger = new Logger(FactoryService.name);

  constructor(
    @InjectRepository(FactoryEntity)
    private readonly factoryRepository: Repository<FactoryEntity>,
    private readonly dataSource: DataSource,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<AllConfigType>,
  ) {}

  /**
   * Create a new factory.
   *
   * `factories.user_id` is NOT NULL, so a login account must exist: either an
   * existing `userId` is linked, or a factory-type credentials row is created
   * from `username`. The account gets an unguessable random password and the
   * factory receives a set-password email, mirroring the fitter flow.
   */
  async create(createFactoryDto: CreateFactoryDto): Promise<FactoryDto> {
    let userId: number | null = createFactoryDto.userId ?? null;

    if (userId === null && createFactoryDto.username) {
      userId = await this.createLoginAccount(
        createFactoryDto.username,
        createFactoryDto.name,
      );
    }

    if (userId === null) {
      throw new BadRequestException(
        "A username is required to create a factory account",
      );
    }

    // Every column on the legacy `factories` table is NOT NULL: default to
    // "" / currency 1 (USD) rather than null.
    const factory = this.factoryRepository.create({
      userId,
      address: createFactoryDto.address ?? "",
      zipcode: createFactoryDto.zipcode ?? "",
      state: createFactoryDto.state ?? "",
      city: createFactoryDto.city ?? "",
      country: createFactoryDto.country ?? "",
      phoneNo: createFactoryDto.phoneNo ?? "",
      cellNo: createFactoryDto.cellNo ?? "",
      currency: createFactoryDto.currency ?? 1,
      emailaddress: createFactoryDto.emailaddress ?? "",
      deleted: 0,
    });

    const savedFactory = await this.factoryRepository.save(factory);

    if (createFactoryDto.username && createFactoryDto.emailaddress) {
      await this.sendWelcomeEmail(
        userId,
        createFactoryDto.username,
        createFactoryDto.emailaddress,
      );
    }

    const [dto] = await this.attachUserData([this.toDto(savedFactory)]);
    return dto;
  }

  /**
   * Insert a factory-type row into `credentials` and return its user_id.
   * The "user" entity is a VIEW on credentials, so INSERTs go to the base table.
   */
  private async createLoginAccount(
    username: string,
    name?: string,
  ): Promise<number> {
    const existing = await this.dataSource.query(
      `SELECT user_id FROM credentials WHERE user_name = $1 LIMIT 1`,
      [username],
    );
    if (existing.length > 0) {
      throw new BadRequestException("Username already exists");
    }

    // The factory never sees this password; they set their own via the
    // emailed reset link. Hash a random secret so the column is never blank.
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(
      randomBytes(32).toString("hex"),
      salt,
    );
    const fullName = name?.trim() || username;

    try {
      const result = await this.dataSource.query(
        `INSERT INTO credentials (
          deleted, user_type, user_name, full_name, password_hash,
          last_login, blocked, password_reset_hash, password_reset_valid_to, supervisor
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING user_id`,
        [
          0, // deleted
          RoleEnum.factory, // user_type 3
          username,
          fullName,
          hashedPassword,
          0, // last_login (unix timestamp)
          0, // blocked = not blocked
          "", // password_reset_hash
          0, // password_reset_valid_to
          0, // supervisor = no
        ],
      );
      const userId: number | undefined = result[0]?.user_id;
      if (userId === undefined) {
        throw new Error("INSERT did not return user_id");
      }
      this.logger.log(
        `Created factory credentials for "${username}" with user_id ${userId}`,
      );
      return userId;
    } catch (error) {
      this.logger.error(`Failed to create user account: ${error.message}`);
      throw new BadRequestException(
        `Failed to create user account: ${error.message}`,
      );
    }
  }

  /**
   * Email the new factory a set-password link. Failure is logged, not thrown:
   * the account and factory already exist and an admin can trigger a reset.
   */
  private async sendWelcomeEmail(
    userId: number,
    username: string,
    email: string,
  ): Promise<void> {
    try {
      const tokenExpiresIn = this.configService.getOrThrow(
        "auth.forgotExpires",
        { infer: true },
      );
      const tokenExpires = Date.now() + ms(tokenExpiresIn);

      // Reset tokens are keyed by the user's UUID from the "user" view
      const userRecord = await this.dataSource.query(
        `SELECT id FROM "user" WHERE legacy_id = $1 LIMIT 1`,
        [userId],
      );
      const userUuid = userRecord[0]?.id;
      if (!userUuid) {
        this.logger.warn(
          `No "user" row for legacy_id ${userId}; skipping welcome email`,
        );
        return;
      }

      const hash = await this.jwtService.signAsync(
        { forgotUserId: userUuid },
        {
          secret: this.configService.getOrThrow("auth.forgotSecret", {
            infer: true,
          }),
          expiresIn: tokenExpiresIn,
        },
      );

      await this.mailService.welcomeFactory({
        to: email,
        data: { hash, tokenExpires },
      });
      this.logger.log(
        `Welcome email sent to factory "${username}" at ${email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${error.message}`,
      );
    }
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

    const [dto] = await this.attachUserData([this.toDto(factory)]);
    return dto;
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
      // Use the actual user/credentials name instead of "Factory in {city}"
      if (raw?.u_name) {
        dto.displayName = raw.u_name;
      }
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

    // Name lives on the login account (credentials.full_name). Skip an empty
    // value so a partial PATCH never blanks the existing name.
    const newName = updateFactoryDto.name?.trim();
    if (newName && factory.userId) {
      await this.dataSource.query(
        `UPDATE credentials SET full_name = $1 WHERE user_id = $2`,
        [newName, factory.userId],
      );
    }

    // Status lives on the login account: credentials.blocked (0 = enabled, 1 = blocked)
    if (updateFactoryDto.enabled !== undefined && factory.userId) {
      await this.dataSource.query(
        `UPDATE credentials SET blocked = $1 WHERE user_id = $2`,
        [updateFactoryDto.enabled ? 0 : 1, factory.userId],
      );
    }

    const savedFactory = await this.factoryRepository.save(factory);
    const [dto] = await this.attachUserData([this.toDto(savedFactory)]);
    return dto;
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
   * Supplement factory DTOs with data that lives on the linked login account
   * (the "user" view over credentials): name, username, enabled, lastLogin.
   * Factories without a linked user are returned unchanged.
   */
  private async attachUserData(dtos: FactoryDto[]): Promise<FactoryDto[]> {
    const userIds = dtos
      .map((d) => d.userId)
      .filter((uid): uid is number => uid !== undefined && uid !== null);

    if (userIds.length === 0) {
      return dtos;
    }

    const users = await this.dataSource.query(
      `SELECT legacy_id, name, username, enabled, last_login FROM "user" WHERE legacy_id = ANY($1::int[])`,
      [userIds],
    );
    const userMap = new Map<number, Record<string, unknown>>();
    for (const u of users) {
      userMap.set(u.legacy_id, u);
    }
    for (const dto of dtos) {
      const user = dto.userId ? userMap.get(dto.userId) : undefined;
      if (user) {
        dto.name = user.name as string;
        dto.username = user.username as string;
        dto.enabled = user.enabled as boolean;
        dto.lastLogin = user.last_login as Date;
        if (user.name) {
          dto.displayName = user.name as string;
        }
      }
    }
    return dtos;
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
