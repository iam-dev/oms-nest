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
import { OptionService } from "./option.service";
import { CreateOptionDto } from "./dto/create-option.dto";
import { UpdateOptionDto } from "./dto/update-option.dto";
import { OptionDto } from "./dto/option.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Option REST API Controller
 *
 * Handles HTTP requests for option management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Options")
@Controller({
  path: "options",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class OptionController {
  constructor(private readonly optionService: OptionService) {}

  @Post()
  @ApiOperation({ summary: "Create a new option" })
  @ApiResponse({
    status: 201,
    description: "Option created successfully",
    type: OptionDto,
  })
  async create(@Body() createOptionDto: CreateOptionDto): Promise<OptionDto> {
    return this.optionService.create(createOptionDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all options" })
  @ApiResponse({
    status: 200,
    description: "Options retrieved successfully",
    type: [OptionDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  @ApiQuery({ name: "group", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: Number })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("group") group?: string,
    @Query("type") type?: number,
  ) {
    return this.optionService.findAll(page, limit, search, group, type);
  }

  @Get("active")
  @ApiOperation({ summary: "Get active options" })
  @ApiResponse({ status: 200, type: [OptionDto] })
  async findActiveOptions(): Promise<OptionDto[]> {
    return this.optionService.findActiveOptions();
  }

  @Get("group/:group")
  @ApiOperation({ summary: "Get options by group" })
  @ApiParam({ name: "group", description: "Option group" })
  @ApiResponse({ status: 200, type: [OptionDto] })
  async findByGroup(@Param("group") group: string): Promise<OptionDto[]> {
    return this.optionService.findByGroup(group);
  }

  @Get("type/:type")
  @ApiOperation({ summary: "Get options by type" })
  @ApiParam({ name: "type", description: "Option type (integer)" })
  @ApiResponse({ status: 200, type: [OptionDto] })
  async findByType(
    @Param("type", ParseIntPipe) type: number,
  ): Promise<OptionDto[]> {
    return this.optionService.findByType(type);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get option by ID" })
  @ApiParam({ name: "id", description: "Option ID (integer)" })
  @ApiResponse({ status: 200, type: OptionDto })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<OptionDto> {
    return this.optionService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update option" })
  @ApiParam({ name: "id", description: "Option ID (integer)" })
  @ApiResponse({ status: 200, type: OptionDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateOptionDto: UpdateOptionDto,
  ): Promise<OptionDto> {
    return this.optionService.update(id, updateOptionDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete option" })
  @ApiParam({ name: "id", description: "Option ID (integer)" })
  @ApiResponse({ status: 204, description: "Option deleted successfully" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.optionService.remove(id);
  }
}
