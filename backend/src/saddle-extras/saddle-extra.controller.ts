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
import { SaddleExtraService } from "./saddle-extra.service";
import { CreateSaddleExtraDto } from "./dto/create-saddle-extra.dto";
import { UpdateSaddleExtraDto } from "./dto/update-saddle-extra.dto";
import { SaddleExtraDto } from "./dto/saddle-extra.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

@ApiTags("Saddle Extras")
@Controller({
  path: "saddle-extras",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SaddleExtraController {
  constructor(private readonly service: SaddleExtraService) {}

  @Post()
  @ApiOperation({ summary: "Create a new saddle-extra association" })
  @ApiResponse({
    status: 201,
    description: "Association created successfully",
    type: SaddleExtraDto,
  })
  async create(
    @Body() createDto: CreateSaddleExtraDto,
  ): Promise<SaddleExtraDto> {
    return this.service.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all saddle-extra associations" })
  @ApiResponse({
    status: 200,
    description: "Associations retrieved successfully",
    type: [SaddleExtraDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "saddleId", required: false, type: Number })
  @ApiQuery({ name: "extraId", required: false, type: Number })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("saddleId") saddleId?: number,
    @Query("extraId") extraId?: number,
  ) {
    return this.service.findAll(page, limit, saddleId, extraId);
  }

  @Get("saddle/:saddleId")
  @ApiOperation({ summary: "Get extra associations for a saddle" })
  @ApiParam({ name: "saddleId", description: "Saddle ID (integer)" })
  @ApiResponse({ status: 200, type: [SaddleExtraDto] })
  async findBySaddleId(
    @Param("saddleId", ParseIntPipe) saddleId: number,
  ): Promise<SaddleExtraDto[]> {
    return this.service.findBySaddleId(saddleId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get association by ID" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleExtraDto })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<SaddleExtraDto> {
    return this.service.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update association" })
  @ApiParam({ name: "id", description: "Association ID (integer)" })
  @ApiResponse({ status: 200, type: SaddleExtraDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateSaddleExtraDto,
  ): Promise<SaddleExtraDto> {
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
