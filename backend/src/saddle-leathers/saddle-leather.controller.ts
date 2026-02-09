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
import { SaddleLeatherService } from "./saddle-leather.service";
import { CreateSaddleLeatherDto } from "./dto/create-saddle-leather.dto";
import { UpdateSaddleLeatherDto } from "./dto/update-saddle-leather.dto";
import { SaddleLeatherDto } from "./dto/saddle-leather.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * SaddleLeather REST API Controller
 *
 * Handles HTTP requests for saddle-leather association operations.
 */
@ApiTags("Saddle Leathers")
@Controller({
  path: "saddle-leathers",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SaddleLeatherController {
  constructor(private readonly service: SaddleLeatherService) {}

  @Post()
  @ApiOperation({ summary: "Create a new saddle-leather association" })
  @ApiResponse({
    status: 201,
    description: "Association created successfully",
    type: SaddleLeatherDto,
  })
  async create(
    @Body() createDto: CreateSaddleLeatherDto,
  ): Promise<SaddleLeatherDto> {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all saddle-leather associations" })
  @ApiResponse({
    status: 200,
    description: "Associations retrieved successfully",
    type: [SaddleLeatherDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "saddleId", required: false, type: Number })
  @ApiQuery({ name: "leatherId", required: false, type: Number })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("saddleId") saddleId?: number,
    @Query("leatherId") leatherId?: number,
  ) {
    return this.service.findAll(page, limit, saddleId, leatherId);
  }

  @Get("saddle/:saddleId")
  @ApiOperation({ summary: "Get leather associations for a saddle" })
  @ApiParam({ name: "saddleId", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleLeatherDto] })
  async findBySaddleId(
    @Param("saddleId", ParseIntPipe) saddleId: number,
  ): Promise<SaddleLeatherDto[]> {
    return this.service.findBySaddleId(saddleId);
  }

  @Get("leather/:leatherId")
  @ApiOperation({ summary: "Get saddle associations for a leather" })
  @ApiParam({ name: "leatherId", description: "Leather ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleLeatherDto] })
  async findByLeatherId(
    @Param("leatherId", ParseIntPipe) leatherId: number,
  ): Promise<SaddleLeatherDto[]> {
    return this.service.findByLeatherId(leatherId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get association by ID" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleLeatherDto })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<SaddleLeatherDto> {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update association" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleLeatherDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSaddleLeatherDto,
  ): Promise<SaddleLeatherDto> {
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
