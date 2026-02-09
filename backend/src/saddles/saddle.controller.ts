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
import { SaddleService } from "./saddle.service";
import { CreateSaddleDto } from "./dto/create-saddle.dto";
import { UpdateSaddleDto } from "./dto/update-saddle.dto";
import { SaddleDto } from "./dto/saddle.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Saddle REST API Controller
 *
 * Handles HTTP requests for saddle management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Saddles")
@Controller({
  path: "saddles",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter, RoleEnum.factory)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SaddleController {
  constructor(private readonly saddleService: SaddleService) {}

  @Post()
  @ApiOperation({ summary: "Create a new saddle" })
  @ApiResponse({
    status: 201,
    description: "Saddle created successfully",
    type: SaddleDto,
  })
  async create(@Body() createDto: CreateSaddleDto): Promise<SaddleDto> {
    return this.saddleService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all saddles" })
  @ApiResponse({
    status: 200,
    description: "Saddles retrieved successfully",
    type: [SaddleDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "id", required: false, type: Number })
  @ApiQuery({ name: "brand", required: false, type: String })
  @ApiQuery({ name: "modelName", required: false, type: String })
  @ApiQuery({ name: "sequence", required: false, type: Number })
  @ApiQuery({ name: "type", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "activeOnly", required: false, type: Boolean })
  @ApiQuery({ name: "active", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("id") id?: number,
    @Query("brand") brand?: string,
    @Query("modelName") modelName?: string,
    @Query("sequence") sequence?: number,
    @Query("type") type?: number,
    @Query("search") search?: string,
    @Query("activeOnly") activeOnly?: boolean,
    @Query("active") active?: string,
  ) {
    return this.saddleService.findAll(
      page,
      limit,
      id,
      brand,
      modelName,
      sequence,
      type,
      search,
      activeOnly,
      active,
    );
  }

  @Get("active")
  @ApiOperation({ summary: "Get active saddles" })
  @ApiResponse({ status: 200, type: [SaddleDto] })
  async findActiveSaddles(): Promise<SaddleDto[]> {
    return this.saddleService.findActiveSaddles();
  }

  @Get("brands")
  @ApiOperation({ summary: "Get unique brand names" })
  @ApiResponse({ status: 200, type: [String] })
  async getUniqueBrands(): Promise<string[]> {
    return this.saddleService.getUniqueBrands();
  }

  @Get("next-sequence")
  @ApiOperation({ summary: "Get next available sequence number" })
  @ApiResponse({ status: 200, type: Number })
  async getNextSequence(): Promise<{ nextSequence: number }> {
    return this.saddleService.getNextSequence();
  }

  @Get("brand/:brand")
  @ApiOperation({ summary: "Get saddles by brand" })
  @ApiParam({ name: "brand", description: "Brand name" })
  @ApiResponse({ status: 200, type: [SaddleDto] })
  async findByBrand(@Param("brand") brand: string): Promise<SaddleDto[]> {
    return this.saddleService.findByBrand(brand);
  }

  @Get("type/:type")
  @ApiOperation({ summary: "Get saddles by type" })
  @ApiParam({ name: "type", description: "Saddle type (integer)" })
  @ApiResponse({ status: 200, type: [SaddleDto] })
  async findByType(
    @Param("type", ParseIntPipe) type: number,
  ): Promise<SaddleDto[]> {
    return this.saddleService.findByType(type);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get saddle by ID" })
  @ApiParam({ name: "id", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleDto })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<SaddleDto> {
    return this.saddleService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update saddle" })
  @ApiParam({ name: "id", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSaddleDto,
  ): Promise<SaddleDto> {
    return this.saddleService.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete saddle" })
  @ApiParam({ name: "id", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 204, description: "Saddle deleted successfully" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.saddleService.remove(id);
  }
}
