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
import { FactoryService } from "./factory.service";
import { CreateFactoryDto } from "./dto/create-factory.dto";
import { UpdateFactoryDto } from "./dto/update-factory.dto";
import { FactoryDto } from "./dto/factory.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLog } from "../audit-logging/decorators";

/**
 * Factory REST API Controller
 *
 * Handles HTTP requests for factory management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Factories")
@Controller({
  path: "factories",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.factory)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class FactoryController {
  constructor(private readonly factoryService: FactoryService) {}

  @Post()
  @AuditLog({ entity: "Factory" })
  @ApiOperation({
    summary: "Create a new factory",
    description: "Creates a new factory with the provided information",
  })
  @ApiResponse({
    status: 201,
    description: "Factory created successfully",
    type: FactoryDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(
    @Body() createFactoryDto: CreateFactoryDto,
  ): Promise<FactoryDto> {
    return this.factoryService.create(createFactoryDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all factories",
    description:
      "Retrieve all factories with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Factories retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/FactoryDto" },
        },
        total: { type: "number" },
        pages: { type: "number" },
      },
    },
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "city", required: false, type: String })
  @ApiQuery({ name: "country", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("city") city?: string,
    @Query("country") country?: string,
  ): Promise<{ data: FactoryDto[]; total: number; pages: number }> {
    return this.factoryService.findAll(page, limit, city, country);
  }

  @Patch(":id/toggle-block")
  @AuditLog({ entity: "Factory" })
  @ApiOperation({
    summary: "Toggle factory block status",
    description: "Toggles the blocked/enabled state of a factory user account",
  })
  @ApiParam({
    name: "id",
    description: "Factory ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Block status toggled",
    schema: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
    },
  })
  async toggleBlock(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<{ enabled: boolean }> {
    return this.factoryService.toggleBlock(id);
  }

  @Get("active")
  @ApiOperation({
    summary: "Get active factories",
    description: "Retrieve all active factories",
  })
  @ApiResponse({
    status: 200,
    description: "Active factories retrieved successfully",
    type: [FactoryDto],
  })
  async findActive(): Promise<FactoryDto[]> {
    return this.factoryService.findActiveFactories();
  }

  @Get("country/:country")
  @ApiOperation({
    summary: "Get factories by country",
    description: "Retrieve all factories in a specific country",
  })
  @ApiParam({
    name: "country",
    description: "Country name",
    example: "United Kingdom",
  })
  @ApiResponse({
    status: 200,
    description: "Factories retrieved successfully",
    type: [FactoryDto],
  })
  async findByCountry(
    @Param("country") country: string,
  ): Promise<FactoryDto[]> {
    return this.factoryService.findByCountry(country);
  }

  @Get("city/:city")
  @ApiOperation({
    summary: "Get factories by city",
    description: "Retrieve all factories in a specific city",
  })
  @ApiParam({
    name: "city",
    description: "City name",
    example: "London",
  })
  @ApiResponse({
    status: 200,
    description: "Factories retrieved successfully",
    type: [FactoryDto],
  })
  async findByCity(@Param("city") city: string): Promise<FactoryDto[]> {
    return this.factoryService.findByCity(city);
  }

  @Get("stats/country/:country/count")
  @ApiOperation({
    summary: "Get factory count by country",
    description: "Get the number of factories in a specific country",
  })
  @ApiParam({
    name: "country",
    description: "Country name",
    example: "United Kingdom",
  })
  @ApiResponse({
    status: 200,
    description: "Factory count retrieved successfully",
    schema: { type: "object", properties: { count: { type: "number" } } },
  })
  async getCountByCountry(
    @Param("country") country: string,
  ): Promise<{ count: number }> {
    const count = await this.factoryService.getCountByCountry(country);
    return { count };
  }

  @Get("stats/active/count")
  @ApiOperation({
    summary: "Get active factory count",
    description: "Get the number of active factories",
  })
  @ApiResponse({
    status: 200,
    description: "Active factory count retrieved successfully",
    schema: { type: "object", properties: { count: { type: "number" } } },
  })
  async getActiveCount(): Promise<{ count: number }> {
    const count = await this.factoryService.getActiveCount();
    return { count };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get factory by ID",
    description: "Retrieve a specific factory by their unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Factory ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Factory found",
    type: FactoryDto,
  })
  @ApiResponse({
    status: 404,
    description: "Factory not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<FactoryDto> {
    return this.factoryService.findOne(id);
  }

  @Patch(":id")
  @AuditLog({ entity: "Factory" })
  @ApiOperation({
    summary: "Update factory",
    description: "Update factory information",
  })
  @ApiParam({
    name: "id",
    description: "Factory ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Factory updated successfully",
    type: FactoryDto,
  })
  @ApiResponse({
    status: 404,
    description: "Factory not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateFactoryDto: UpdateFactoryDto,
  ): Promise<FactoryDto> {
    return this.factoryService.update(id, updateFactoryDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "Factory" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete factory",
    description: "Soft delete a factory (sets deleted flag)",
  })
  @ApiParam({
    name: "id",
    description: "Factory ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 204,
    description: "Factory deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Factory not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.factoryService.remove(id);
  }
}
