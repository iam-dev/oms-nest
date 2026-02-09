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
import { OptionItemService } from "./option-item.service";
import { CreateOptionItemDto } from "./dto/create-option-item.dto";
import { UpdateOptionItemDto } from "./dto/update-option-item.dto";
import { OptionItemDto } from "./dto/option-item.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * OptionItem REST API Controller
 *
 * Handles HTTP requests for option item management operations.
 * Uses integer IDs to match PostgreSQL schema.
 */
@ApiTags("Option Items")
@Controller({
  path: "option-items",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class OptionItemController {
  constructor(private readonly optionItemService: OptionItemService) {}

  @Post()
  @ApiOperation({ summary: "Create a new option item" })
  @ApiResponse({
    status: 201,
    description: "Option item created successfully",
    type: OptionItemDto,
  })
  async create(@Body() createDto: CreateOptionItemDto): Promise<OptionItemDto> {
    return this.optionItemService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all option items" })
  @ApiResponse({
    status: 200,
    description: "Option items retrieved successfully",
    type: [OptionItemDto],
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "optionId", required: false, type: Number })
  @ApiQuery({ name: "leatherId", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("optionId") optionId?: number,
    @Query("leatherId") leatherId?: number,
    @Query("search") search?: string,
  ) {
    return this.optionItemService.findAll(
      page,
      limit,
      optionId,
      leatherId,
      search,
    );
  }

  @Get("active")
  @ApiOperation({ summary: "Get active option items" })
  @ApiResponse({ status: 200, type: [OptionItemDto] })
  async findActiveItems(): Promise<OptionItemDto[]> {
    return this.optionItemService.findActiveItems();
  }

  @Get("option/:optionId")
  @ApiOperation({ summary: "Get option items by option ID" })
  @ApiParam({ name: "optionId", description: "Option ID (integer)" })
  @ApiResponse({ status: 200, type: [OptionItemDto] })
  async findByOptionId(
    @Param("optionId", ParseIntPipe) optionId: number,
  ): Promise<OptionItemDto[]> {
    return this.optionItemService.findByOptionId(optionId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get option item by ID" })
  @ApiParam({ name: "id", description: "Option item ID (integer)" })
  @ApiResponse({ status: 200, type: OptionItemDto })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<OptionItemDto> {
    return this.optionItemService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update option item" })
  @ApiParam({ name: "id", description: "Option item ID (integer)" })
  @ApiResponse({ status: 200, type: OptionItemDto })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateOptionItemDto,
  ): Promise<OptionItemDto> {
    return this.optionItemService.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete option item" })
  @ApiParam({ name: "id", description: "Option item ID (integer)" })
  @ApiResponse({ status: 204, description: "Option item deleted successfully" })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.optionItemService.remove(id);
  }
}
