import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpStatus,
  HttpCode,
  SerializeOptions,
} from "@nestjs/common";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuthGuard } from "@nestjs/passport";

import {
  InfinityPaginationResponse,
  InfinityPaginationResponseDto,
} from "../utils/dto/infinity-pagination-response.dto";
import { NullableType } from "../utils/types/nullable.type";
import { QueryUserDto } from "./dto/query-user.dto";
import { User } from "./domain/user";
import { UsersService } from "./users.service";
import { RolesGuard } from "../roles/roles.guard";
import { infinityPagination } from "../utils/infinity-pagination";
import { AuditLog } from "../audit-logging/decorators";

@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
@ApiTags("Users")
@Controller({
  path: "users",
  version: "1",
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiCreatedResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ["admin"],
  })
  @Post()
  @AuditLog({ entity: "User" })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createProfileDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createProfileDto);
  }

  @ApiOkResponse({
    type: InfinityPaginationResponse(User),
  })
  @SerializeOptions({
    groups: ["admin"],
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query() query: QueryUserDto,
  ): Promise<InfinityPaginationResponseDto<User>> {
    const page = query?.page ?? 1;
    let limit = query?.limit ?? 10;
    if (limit > 50) {
      limit = 50;
    }

    const [users, totalCount] = await Promise.all([
      this.usersService.findManyWithPagination({
        filterOptions: query?.filters,
        sortOptions: query?.sort,
        paginationOptions: {
          page,
          limit,
        },
      }),
      this.usersService.count(query?.filters),
    ]);

    // Populate typeName (role) for each user
    const usersWithRoles = await Promise.all(
      users.map(async (user) => {
        const role = await this.usersService.getUserRole(
          user.legacyId ?? user.id,
          user.username,
          user.userType,
          user.isSupervisor,
        );
        user.typeName = role.name;
        return user;
      }),
    );

    return infinityPagination(usersWithRoles, { page, limit }, totalCount);
  }

  @ApiOkResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ["admin"],
  })
  @Get(":id")
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: "id",
    type: String,
    required: true,
  })
  findOne(@Param("id") id: User["id"]): Promise<NullableType<User>> {
    return this.usersService.findById(id);
  }

  @ApiOkResponse({
    type: User,
  })
  @SerializeOptions({
    groups: ["admin"],
  })
  @Patch(":id")
  @AuditLog({ entity: "User" })
  @HttpCode(HttpStatus.OK)
  @ApiParam({
    name: "id",
    type: String,
    required: true,
  })
  update(
    @Param("id") id: User["id"],
    @Body() updateProfileDto: UpdateUserDto,
  ): Promise<User | null> {
    return this.usersService.update(id, updateProfileDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "User" })
  @ApiParam({
    name: "id",
    type: String,
    required: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: User["id"]): Promise<void> {
    return this.usersService.remove(id);
  }
}
