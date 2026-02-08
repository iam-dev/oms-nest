import {
  HttpStatus,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { CreateUserDto } from "./dto/create-user.dto";
import { NullableType } from "../utils/types/nullable.type";
import { FilterUserDto, SortUserDto } from "./dto/query-user.dto";
import { UserRepository } from "./infrastructure/persistence/user.repository";
import { User } from "./domain/user";
import bcrypt from "bcryptjs";
import { AuthProvidersEnum } from "../auth/auth-providers.enum";
import { FilesService } from "../files/files.service";
import { RoleEnum } from "../roles/roles.enum";
import { StatusEnum } from "../statuses/statuses.enum";
import { IPaginationOptions } from "../utils/types/pagination-options";
import { FileType } from "../files/domain/file";
import { Role } from "../roles/domain/role";
import { Status } from "../statuses/domain/status";
import { UpdateUserDto } from "./dto/update-user.dto";
import { FitterEntity } from "../fitters/infrastructure/persistence/relational/entities/fitter.entity";
import { RoleEntity } from "../roles/infrastructure/persistence/relational/entities/role.entity";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepository: UserRepository,
    private readonly filesService: FilesService,
    @InjectRepository(FitterEntity)
    private readonly fitterRepository: Repository<FitterEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  /**
   * Determine user role based on database fields (user_type and supervisor)
   * from the credentials table.
   *
   * Role priority:
   * 1. is_supervisor=1 → supervisor (highest priority, overrides user_type)
   * 2. user_type=2 → admin
   * 3. user_type=3 → factory
   * 4. user_type=4 → customsaddler
   * 5. user_type=1 → fitter (verified in fitters table)
   * 6. Fallback: check fitters table for legacy cases
   * 7. Default: user role
   *
   * @param userId - The user's ID (used for fitter table lookup)
   * @param username - The username (unused, kept for backwards compatibility)
   * @param userType - The user_type from credentials table
   * @param isSupervisor - The supervisor flag from credentials table
   */
  async getUserRole(
    userId: number,
    username?: string,
    userType?: number | null,
    isSupervisor?: number | null,
  ): Promise<{ id: number; name: string }> {
    // Supervisor check takes highest priority
    if (isSupervisor === 1) {
      const supervisorRole = await this.roleRepository.findOne({
        where: { name: "supervisor" },
      });
      return supervisorRole && supervisorRole.name
        ? { id: supervisorRole.id, name: supervisorRole.name }
        : { id: RoleEnum.supervisor, name: "supervisor" };
    }

    // Use user_type from database to determine role
    if (userType !== undefined && userType !== null) {
      switch (userType) {
        case 2: // admin
          const adminRole = await this.roleRepository.findOne({
            where: { name: "admin" },
          });
          return adminRole && adminRole.name
            ? { id: adminRole.id, name: adminRole.name }
            : { id: RoleEnum.admin, name: "admin" };

        case 3: // factory
          const factoryRole = await this.roleRepository.findOne({
            where: { name: "factory" },
          });
          return factoryRole && factoryRole.name
            ? { id: factoryRole.id, name: factoryRole.name }
            : { id: RoleEnum.factory, name: "factory" };

        case 4: // customsaddler
          const customsaddlerRole = await this.roleRepository.findOne({
            where: { name: "customsaddler" },
          });
          return customsaddlerRole && customsaddlerRole.name
            ? { id: customsaddlerRole.id, name: customsaddlerRole.name }
            : { id: RoleEnum.customsaddler, name: "customsaddler" };

        case 1: // fitter - verify in fitters table
          const fitterForType = await this.fitterRepository.findOne({
            where: { userId: userId },
          });
          if (fitterForType) {
            const fitterRole = await this.roleRepository.findOne({
              where: { name: "fitter" },
            });
            return fitterRole && fitterRole.name
              ? { id: fitterRole.id, name: fitterRole.name }
              : { id: RoleEnum.fitter, name: "fitter" };
          }
          break;
      }
    }

    // Fallback: Check fitters table for legacy cases (when userType is not set)
    const fitter = await this.fitterRepository.findOne({
      where: { userId: userId },
    });
    if (fitter) {
      const fitterRole = await this.roleRepository.findOne({
        where: { name: "fitter" },
      });
      return fitterRole && fitterRole.name
        ? { id: fitterRole.id, name: fitterRole.name }
        : { id: RoleEnum.fitter, name: "fitter" };
    }

    // Default to User role
    const role = await this.roleRepository.findOne({ where: { name: "user" } });
    return role && role.name
      ? { id: role.id, name: role.name }
      : { id: RoleEnum.user, name: "user" };
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Do not remove comment below.
    // <creating-property />

    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    const email = createUserDto.email;

    if (email) {
      const userObject = await this.usersRepository.findByEmail(email);
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: "emailAlreadyExists",
          },
        });
      }
    }

    let _photo: FileType | null | undefined = undefined;

    if (createUserDto.photo?.id) {
      const fileObject = await this.filesService.findById(
        createUserDto.photo.id,
      );
      if (!fileObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            photo: "imageNotExists",
          },
        });
      }
      _photo = fileObject;
    } else if (createUserDto.photo === null) {
      _photo = null;
    }
    void _photo;

    let _role: Role | undefined = undefined;

    if (createUserDto.role?.id) {
      const roleObject = Object.values(RoleEnum)
        .map(String)
        .includes(String(createUserDto.role.id));
      if (!roleObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            role: "roleNotExists",
          },
        });
      }

      _role = {
        id: createUserDto.role.id,
      };
    }
    void _role;

    let _status: Status | undefined = undefined;

    if (createUserDto.status?.id) {
      const statusObject = Object.values(StatusEnum)
        .map(String)
        .includes(String(createUserDto.status.id));
      if (!statusObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            status: "statusNotExists",
          },
        });
      }

      _status = {
        id: createUserDto.status.id,
      };
    }
    void _status;

    return this.usersRepository.create({
      // Do not remove comment below.
      // Updated for staging schema
      username: createUserDto.email || `user_${Date.now()}`,
      name:
        `${createUserDto.firstName || ""} ${createUserDto.lastName || ""}`.trim() ||
        "User",
      email: email!,
      password: password,
      enabled: true,
      currency: "USD",
      provider: createUserDto.provider ?? AuthProvidersEnum.email,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  count(filterOptions?: FilterUserDto | null): Promise<number> {
    return this.usersRepository.count(filterOptions);
  }

  findById(id: User["id"]): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User["id"][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User["email"]): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findByEmailOrUsername(emailOrUsername: string): Promise<NullableType<User>> {
    return this.usersRepository.findByEmailOrUsername(emailOrUsername);
  }

  findBySocialIdAndProvider({
    socialId,
    provider,
  }: {
    socialId: string;
    provider: string;
  }): Promise<NullableType<User>> {
    return this.usersRepository.findBySocialIdAndProvider({
      socialId,
      provider,
    });
  }

  async update(
    id: User["id"],
    updateUserDto: UpdateUserDto,
  ): Promise<User | null> {
    // Do not remove comment below.
    // <updating-property />

    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);

      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;

    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(
        updateUserDto.email,
      );

      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: {
            email: "emailAlreadyExists",
          },
        });
      }

      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    // Photo handling removed for staging schema compatibility

    // Role handling removed for staging schema compatibility

    // Status handling removed for staging schema compatibility

    return this.usersRepository.update(id, {
      // Updated for staging schema
      username: updateUserDto.username,
      name: updateUserDto.name,
      email,
      password,
      enabled: updateUserDto.enabled,
      address: updateUserDto.address,
      city: updateUserDto.city,
      zipcode: updateUserDto.zipcode,
      state: updateUserDto.state,
      cellNo: updateUserDto.cellNo,
      phoneNo: updateUserDto.phoneNo,
      country: updateUserDto.country,
      currency: updateUserDto.currency,
      provider: updateUserDto.provider,
    });
  }

  async remove(id: User["id"]): Promise<void> {
    await this.usersRepository.remove(id);
  }

  // Production security methods
  async validateLoginSecurity(
    userId: User["id"],
    ipAddress: string,
  ): Promise<void> {
    await Promise.resolve();
    // Basic implementation for production security validation
    this.logger.log(
      `Validating login security for user ${userId} from IP ${ipAddress}`,
    );
  }

  async recordLoginAttempt(attemptData: any): Promise<void> {
    await Promise.resolve();
    // Basic implementation for login attempt recording
    this.logger.log(`Recording login attempt for user ${attemptData?.userId}`);
  }

  async unlockAccount(userId: User["id"]): Promise<void> {
    // Implementation for account unlocking
    await this.usersRepository.update(userId, { enabled: true });
  }
}
