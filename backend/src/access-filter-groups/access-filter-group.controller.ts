import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AccessFilterGroupService } from "./access-filter-group.service";
import { CreateAccessFilterGroupDto } from "./dto/create-access-filter-group.dto";
import { UpdateAccessFilterGroupDto } from "./dto/update-access-filter-group.dto";
import { QueryAccessFilterGroupDto } from "./dto/query-access-filter-group.dto";
import { AccessFilterGroupEntity } from "./infrastructure/persistence/relational/entities/access-filter-group.entity";

@ApiTags("Access Filter Groups")
@Controller({
  path: "access-filter-groups",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class AccessFilterGroupController {
  constructor(private readonly service: AccessFilterGroupService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new access filter group",
    description:
      "Creates a new access filter group with the provided configuration",
  })
  @ApiResponse({
    status: 201,
    description: "Access filter group created successfully",
    type: AccessFilterGroupEntity,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(
    @Body() createDto: CreateAccessFilterGroupDto,
  ): Promise<AccessFilterGroupEntity> {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all access filter groups",
    description:
      "Retrieve all access filter groups with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Access filter groups retrieved successfully",
    type: [AccessFilterGroupEntity],
  })
  @ApiQuery({
    name: "query",
    type: QueryAccessFilterGroupDto,
    required: false,
    description: "Query parameters for filtering and pagination",
  })
  async findAll(
    @Query() query: QueryAccessFilterGroupDto,
  ): Promise<AccessFilterGroupEntity[]> {
    return this.service.findAll(query);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get access filter group by ID",
    description:
      "Retrieve a specific access filter group by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Access filter group UUID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 200,
    description: "Access filter group found",
    type: AccessFilterGroupEntity,
  })
  @ApiResponse({
    status: 404,
    description: "Access filter group not found",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AccessFilterGroupEntity> {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update access filter group",
    description: "Update access filter group information",
  })
  @ApiParam({
    name: "id",
    description: "Access filter group UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Access filter group updated successfully",
    type: AccessFilterGroupEntity,
  })
  @ApiResponse({
    status: 404,
    description: "Access filter group not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateAccessFilterGroupDto,
  ): Promise<AccessFilterGroupEntity> {
    return this.service.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete access filter group",
    description:
      "Soft delete an access filter group (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Access filter group UUID",
  })
  @ApiResponse({
    status: 204,
    description: "Access filter group deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Access filter group not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }

  @Get("stats/count")
  @ApiOperation({
    summary: "Get count of active access filter groups",
    description: "Returns the count of active access filter groups",
  })
  @ApiResponse({
    status: 200,
    description: "Count retrieved successfully",
    schema: {
      type: "object",
      properties: {
        count: { type: "number", example: 42 },
      },
    },
  })
  async countActive(): Promise<{ count: number }> {
    const count = await this.service.countActive();
    return { count };
  }

  @Post(":id/restore")
  @ApiOperation({
    summary: "Restore a soft-deleted access filter group",
    description:
      "Restore an access filter group that was previously soft-deleted",
  })
  @ApiParam({
    name: "id",
    description: "Access filter group UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Access filter group restored successfully",
    type: AccessFilterGroupEntity,
  })
  @ApiResponse({
    status: 404,
    description: "Access filter group not found",
  })
  async restore(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<AccessFilterGroupEntity> {
    return this.service.restore(id);
  }
}
