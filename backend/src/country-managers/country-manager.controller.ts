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
import { CountryManagerService } from "./country-manager.service";
import { CreateCountryManagerDto } from "./dto/create-country-manager.dto";
import { UpdateCountryManagerDto } from "./dto/update-country-manager.dto";
import { QueryCountryManagerDto } from "./dto/query-country-manager.dto";
import { CountryManagerDto } from "./dto/country-manager.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Country Manager REST API Controller
 *
 * Handles HTTP requests for country manager operations
 */
@ApiTags("Country Managers")
@Controller({
  path: "country_managers",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CountryManagerController {
  constructor(private readonly countryManagerService: CountryManagerService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new country manager",
    description: "Creates a new country manager with the provided information",
  })
  @ApiResponse({
    status: 201,
    description: "Country manager created successfully",
    type: CountryManagerDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: 409,
    description: "Country manager with this user ID already exists",
  })
  async create(
    @Body() createCountryManagerDto: CreateCountryManagerDto,
  ): Promise<CountryManagerDto> {
    return this.countryManagerService.create(createCountryManagerDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all country managers",
    description:
      "Retrieve all country managers with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Country managers retrieved successfully",
    type: [CountryManagerDto],
  })
  @ApiQuery({
    name: "query",
    type: QueryCountryManagerDto,
    required: false,
    description: "Query parameters for filtering and pagination",
  })
  async findAll(
    @Query() query: QueryCountryManagerDto,
  ): Promise<CountryManagerDto[]> {
    return this.countryManagerService.findAll(query);
  }

  @Get("active")
  @ApiOperation({
    summary: "Get active country managers",
    description: "Retrieve all active country managers",
  })
  @ApiResponse({
    status: 200,
    description: "Active country managers retrieved successfully",
    type: [CountryManagerDto],
  })
  async findActive(): Promise<CountryManagerDto[]> {
    return this.countryManagerService.findActive();
  }

  @Get("statistics/overview")
  @ApiOperation({
    summary: "Get country manager statistics",
    description: "Get country manager statistics for reporting",
  })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        total: { type: "number" },
        active: { type: "number" },
        inactive: { type: "number" },
      },
    },
  })
  async getCountryManagerStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    return this.countryManagerService.getCountryManagerStatistics();
  }

  @Get("country/:country")
  @ApiOperation({
    summary: "Get country managers by country",
    description: "Retrieve all country managers for a specific country",
  })
  @ApiParam({
    name: "country",
    description: "Country name",
    example: "United Kingdom",
  })
  @ApiResponse({
    status: 200,
    description: "Country managers retrieved successfully",
    type: [CountryManagerDto],
  })
  async findByCountry(
    @Param("country") country: string,
  ): Promise<CountryManagerDto[]> {
    return this.countryManagerService.findByCountry(country);
  }

  @Get("region/:region")
  @ApiOperation({
    summary: "Get country managers by region",
    description: "Retrieve all country managers in a specific region",
  })
  @ApiParam({
    name: "region",
    description: "Region name",
    example: "Scotland",
  })
  @ApiResponse({
    status: 200,
    description: "Country managers retrieved successfully",
    type: [CountryManagerDto],
  })
  async findByRegion(
    @Param("region") region: string,
  ): Promise<CountryManagerDto[]> {
    return this.countryManagerService.findByRegion(region);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get country manager by ID",
    description:
      "Retrieve a specific country manager by their unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Country manager UUID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 200,
    description: "Country manager found",
    type: CountryManagerDto,
  })
  @ApiResponse({
    status: 404,
    description: "Country manager not found",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<CountryManagerDto> {
    return this.countryManagerService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update country manager",
    description: "Update country manager information",
  })
  @ApiParam({
    name: "id",
    description: "Country manager UUID",
  })
  @ApiResponse({
    status: 200,
    description: "Country manager updated successfully",
    type: CountryManagerDto,
  })
  @ApiResponse({
    status: 404,
    description: "Country manager not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCountryManagerDto: UpdateCountryManagerDto,
  ): Promise<CountryManagerDto> {
    return this.countryManagerService.update(id, updateCountryManagerDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete country manager",
    description: "Soft delete a country manager (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Country manager UUID",
  })
  @ApiResponse({
    status: 204,
    description: "Country manager deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Country manager not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.countryManagerService.remove(id);
  }
}
