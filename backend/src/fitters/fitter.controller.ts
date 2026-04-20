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
import { FitterService } from "./fitter.service";
import { CreateFitterDto } from "./dto/create-fitter.dto";
import { UpdateFitterDto } from "./dto/update-fitter.dto";
import { FitterDto } from "./dto/fitter.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLog } from "../audit-logging/decorators";

/**
 * Fitter REST API Controller
 *
 * Handles HTTP requests for fitter management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Fitters")
@Controller({
  path: "fitters",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class FitterController {
  constructor(private readonly fitterService: FitterService) {}

  @Post()
  @AuditLog({ entity: "Fitter" })
  @ApiOperation({
    summary: "Create a new fitter",
    description: "Creates a new fitter with the provided information",
  })
  @ApiResponse({
    status: 201,
    description: "Fitter created successfully",
    type: FitterDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(@Body() createFitterDto: CreateFitterDto): Promise<FitterDto> {
    return this.fitterService.create(createFitterDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all fitters",
    description: "Retrieve all fitters with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Fitters retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/FitterDto" },
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
  @ApiQuery({ name: "searchTerm", required: false, type: String })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiQuery({ name: "username", required: false, type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("city") city?: string,
    @Query("country") country?: string,
    @Query("searchTerm") searchTerm?: string,
    @Query("name") name?: string,
    @Query("username") username?: string,
    @Query("status") status?: string,
  ): Promise<{ data: FitterDto[]; total: number; pages: number }> {
    return this.fitterService.findAll(
      page,
      limit,
      city,
      country,
      searchTerm,
      name,
      username,
      status,
    );
  }

  @Patch(":id/toggle-block")
  @AuditLog({ entity: "Fitter" })
  @ApiOperation({
    summary: "Toggle fitter block status",
    description: "Toggles the blocked/enabled state of a fitter user account",
  })
  @ApiParam({
    name: "id",
    description: "Fitter ID (integer)",
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
    return this.fitterService.toggleBlock(id);
  }

  @Get("countries")
  @ApiOperation({
    summary: "Get distinct fitter countries",
    description:
      "Returns distinct country values used by fitters, sorted alphabetically",
  })
  @ApiResponse({
    status: 200,
    description: "Country list retrieved",
    schema: { type: "array", items: { type: "string" } },
  })
  async findCountries(): Promise<string[]> {
    return this.fitterService.findDistinctCountries();
  }

  @Get("active")
  @ApiOperation({
    summary: "Get active fitters",
    description: "Retrieve all active fitters",
  })
  @ApiResponse({
    status: 200,
    description: "Active fitters retrieved successfully",
    type: [FitterDto],
  })
  async findActive(): Promise<FitterDto[]> {
    return this.fitterService.findActiveFitters();
  }

  @Get("country/:country")
  @ApiOperation({
    summary: "Get fitters by country",
    description: "Retrieve all fitters in a specific country",
  })
  @ApiParam({
    name: "country",
    description: "Country name",
    example: "United Kingdom",
  })
  @ApiResponse({
    status: 200,
    description: "Fitters retrieved successfully",
    type: [FitterDto],
  })
  async findByCountry(@Param("country") country: string): Promise<FitterDto[]> {
    return this.fitterService.findByCountry(country);
  }

  @Get("city/:city")
  @ApiOperation({
    summary: "Get fitters by city",
    description: "Retrieve all fitters in a specific city",
  })
  @ApiParam({
    name: "city",
    description: "City name",
    example: "London",
  })
  @ApiResponse({
    status: 200,
    description: "Fitters retrieved successfully",
    type: [FitterDto],
  })
  async findByCity(@Param("city") city: string): Promise<FitterDto[]> {
    return this.fitterService.findByCity(city);
  }

  @Get("stats/country/:country/count")
  @ApiOperation({
    summary: "Get fitter count by country",
    description: "Get the number of fitters in a specific country",
  })
  @ApiParam({
    name: "country",
    description: "Country name",
    example: "United Kingdom",
  })
  @ApiResponse({
    status: 200,
    description: "Fitter count retrieved successfully",
    schema: { type: "object", properties: { count: { type: "number" } } },
  })
  async getCountByCountry(
    @Param("country") country: string,
  ): Promise<{ count: number }> {
    const count = await this.fitterService.getCountByCountry(country);
    return { count };
  }

  @Get("stats/active/count")
  @ApiOperation({
    summary: "Get active fitter count",
    description: "Get the number of active fitters",
  })
  @ApiResponse({
    status: 200,
    description: "Active fitter count retrieved successfully",
    schema: { type: "object", properties: { count: { type: "number" } } },
  })
  async getActiveCount(): Promise<{ count: number }> {
    const count = await this.fitterService.getActiveCount();
    return { count };
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get fitter by ID",
    description: "Retrieve a specific fitter by their unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Fitter ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Fitter found",
    type: FitterDto,
  })
  @ApiResponse({
    status: 404,
    description: "Fitter not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<FitterDto> {
    return this.fitterService.findOne(id);
  }

  @Patch(":id")
  @AuditLog({ entity: "Fitter" })
  @ApiOperation({
    summary: "Update fitter",
    description: "Update fitter information",
  })
  @ApiParam({
    name: "id",
    description: "Fitter ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Fitter updated successfully",
    type: FitterDto,
  })
  @ApiResponse({
    status: 404,
    description: "Fitter not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateFitterDto: UpdateFitterDto,
  ): Promise<FitterDto> {
    return this.fitterService.update(id, updateFitterDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "Fitter" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete fitter",
    description: "Soft delete a fitter (sets deleted flag)",
  })
  @ApiParam({
    name: "id",
    description: "Fitter ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 204,
    description: "Fitter deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Fitter not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.fitterService.remove(id);
  }
}
