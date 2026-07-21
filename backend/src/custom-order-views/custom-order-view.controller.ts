import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
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
} from "@nestjs/swagger";
import { JwtRolesGuard } from "../auth/guards/jwt-roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { CustomOrderViewService } from "./custom-order-view.service";
import { CreateCustomOrderViewDto } from "./dto/create-custom-order-view.dto";
import { UpdateCustomOrderViewDto } from "./dto/update-custom-order-view.dto";
import { CurrentUserId } from "../auth/decorators/current-user-id.decorator";

@ApiTags("Custom Order Views")
@Controller({ path: "custom-order-views", version: "1" })
@ApiCookieAuth("token")
// BE-012: FITTER and FACTORY roles added — custom-order-views are per-user, not admin-only.
// Seeded users (e.g. adamwhitehouse) are fitters who need read/write access to their own views.
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter, RoleEnum.factory)
@UseGuards(JwtRolesGuard)
export class CustomOrderViewController {
  constructor(private readonly service: CustomOrderViewService) {}

  @Post()
  @ApiOperation({ summary: "Create a custom order view" })
  @ApiResponse({ status: 201, description: "View created" })
  async create(
    @CurrentUserId() userId: number,
    @Body() dto: CreateCustomOrderViewDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List all custom order views for current user" })
  @ApiResponse({ status: 200, description: "List of views" })
  async findAll(@CurrentUserId() userId: number) {
    return this.service.findAll(userId);
  }

  @Get("default")
  @ApiOperation({ summary: "Get the default view for current user" })
  @ApiResponse({ status: 200, description: "Default view or null" })
  async findDefault(@CurrentUserId() userId: number) {
    return this.service.findDefault(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific custom order view" })
  @ApiResponse({ status: 200, description: "View details" })
  async findOne(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.findOne(id, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a custom order view" })
  @ApiResponse({ status: 200, description: "Updated view" })
  async update(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomOrderViewDto,
  ) {
    return this.service.update(id, userId, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a custom order view" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, userId);
  }
}
