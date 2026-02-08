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
import { SaddleOptionsItemService } from "./saddle-options-item.service";
import { CreateSaddleOptionsItemDto } from "./dto/create-saddle-options-item.dto";
import { UpdateSaddleOptionsItemDto } from "./dto/update-saddle-options-item.dto";
import { SaddleOptionsItemDto } from "./dto/saddle-options-item.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * SaddleOptionsItem REST API Controller
 *
 * Handles HTTP requests for saddle-options-item configuration operations.
 */
@ApiTags("Saddle Options Items")
@Controller({
  path: "saddle-options-items",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SaddleOptionsItemController {
  constructor(private readonly service: SaddleOptionsItemService) {}

  @Post()
  @ApiOperation({ summary: "Create a new saddle-options-item association" })
  @ApiResponse({
    status: 201,
    description: "Association created successfully",
    type: SaddleOptionsItemDto,
  })
  async create(
    @Body() createDto: CreateSaddleOptionsItemDto,
  ): Promise<SaddleOptionsItemDto> {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all saddle-options-item associations" })
  @ApiResponse({
    status: 200,
    description: "Associations retrieved successfully",
    type: [SaddleOptionsItemDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "saddleId", required: false, type: Number })
  @ApiQuery({ name: "optionId", required: false, type: Number })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("saddleId") saddleId?: number,
    @Query("optionId") optionId?: number,
  ) {
    return this.service.findAll(page, limit, saddleId, optionId);
  }

  @Get("saddle/:saddleId")
  @ApiOperation({ summary: "Get option item associations for a saddle" })
  @ApiParam({ name: "saddleId", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleOptionsItemDto] })
  async findBySaddleId(
    @Param("saddleId", ParseIntPipe) saddleId: number,
  ): Promise<SaddleOptionsItemDto[]> {
    return this.service.findBySaddleId(saddleId);
  }

  @Get("option/:optionId")
  @ApiOperation({ summary: "Get saddle associations for an option" })
  @ApiParam({ name: "optionId", description: "Option ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleOptionsItemDto] })
  async findByOptionId(
    @Param("optionId", ParseIntPipe) optionId: number,
  ): Promise<SaddleOptionsItemDto[]> {
    return this.service.findByOptionId(optionId);
  }

  @Get("saddle/:saddleId/option/:optionId")
  @ApiOperation({
    summary: "Get associations for a specific saddle and option",
  })
  @ApiParam({ name: "saddleId", description: "Saddle ID (integer)" })
  @ApiParam({ name: "optionId", description: "Option ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleOptionsItemDto] })
  async findBySaddleAndOption(
    @Param("saddleId", ParseIntPipe) saddleId: number,
    @Param("optionId", ParseIntPipe) optionId: number,
  ): Promise<SaddleOptionsItemDto[]> {
    return this.service.findBySaddleAndOption(saddleId, optionId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get association by ID" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleOptionsItemDto })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<SaddleOptionsItemDto> {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update association" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleOptionsItemDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSaddleOptionsItemDto,
  ): Promise<SaddleOptionsItemDto> {
    return this.service.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete association" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 204, description: "Association deleted successfully" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.service.remove(id);
  }
}
