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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { LeathertypeService } from "./leathertype.service";
import { CreateLeathertypeDto } from "./dto/create-leathertype.dto";
import { UpdateLeathertypeDto } from "./dto/update-leathertype.dto";
import { LeathertypeDto } from "./dto/leathertype.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Leathertype REST API Controller
 *
 * Handles HTTP requests for leathertype management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Leathertypes")
@Controller({
  path: "leathertypes",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class LeathertypeController {
  constructor(private readonly leathertypeService: LeathertypeService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new leathertype",
    description: "Creates a new leathertype with the provided information",
  })
  @ApiResponse({
    status: 201,
    description: "Leathertype created successfully",
    type: LeathertypeDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: 409,
    description: "Leathertype with this name already exists",
  })
  async create(
    @Body() createLeathertypeDto: CreateLeathertypeDto,
  ): Promise<LeathertypeDto> {
    return this.leathertypeService.create(createLeathertypeDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all leathertypes",
    description:
      "Retrieve all leathertypes with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Leathertypes retrieved successfully",
    type: [LeathertypeDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
  ): Promise<{ data: LeathertypeDto[]; total: number; pages: number }> {
    return this.leathertypeService.findAll(page, limit, search);
  }

  @Get("active")
  @ApiOperation({
    summary: "Get active leathertypes",
    description: "Retrieve all active leathertypes available for use",
  })
  @ApiResponse({
    status: 200,
    description: "Active leathertypes retrieved successfully",
    type: [LeathertypeDto],
  })
  async findActiveLeathertypes(): Promise<LeathertypeDto[]> {
    return this.leathertypeService.findActiveLeathertypes();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get leathertype by ID",
    description: "Retrieve a specific leathertype by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Leathertype ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Leathertype found",
    type: LeathertypeDto,
  })
  @ApiResponse({
    status: 404,
    description: "Leathertype not found",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<LeathertypeDto> {
    return this.leathertypeService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update leathertype",
    description: "Update leathertype information",
  })
  @ApiParam({
    name: "id",
    description: "Leathertype ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Leathertype updated successfully",
    type: LeathertypeDto,
  })
  @ApiResponse({
    status: 404,
    description: "Leathertype not found",
  })
  @ApiResponse({
    status: 409,
    description: "Name conflict with existing leathertype",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateLeathertypeDto: UpdateLeathertypeDto,
  ): Promise<LeathertypeDto> {
    return this.leathertypeService.update(id, updateLeathertypeDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete leathertype",
    description: "Soft delete a leathertype (sets deleted flag)",
  })
  @ApiParam({
    name: "id",
    description: "Leathertype ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 204,
    description: "Leathertype deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Leathertype not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.leathertypeService.remove(id);
  }
}
