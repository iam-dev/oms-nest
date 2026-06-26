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
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { CustomOrderViewGroupService } from "./custom-order-view-group.service";
import { CreateCustomOrderViewGroupDto } from "./dto/create-custom-order-view-group.dto";
import { UpdateCustomOrderViewGroupDto } from "./dto/update-custom-order-view-group.dto";
import { CurrentUserId } from "../auth/decorators/current-user-id.decorator";

@ApiTags("Custom Order View Groups")
@Controller({ path: "custom-order-view-groups", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomOrderViewGroupController {
  constructor(private readonly service: CustomOrderViewGroupService) {}

  @Post()
  @ApiOperation({ summary: "Create a custom order view group" })
  @ApiResponse({ status: 201, description: "Group created" })
  async create(
    @CurrentUserId() userId: number,
    @Body() dto: CreateCustomOrderViewGroupDto,
  ) {
    return this.service.create(userId, dto);
  }

  @Get()
  @ApiOperation({
    summary: "List all view groups with nested views for current user",
  })
  @ApiResponse({ status: 200, description: "List of groups with views" })
  async findAll(@CurrentUserId() userId: number) {
    return this.service.findAllWithViews(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific view group with its views" })
  @ApiResponse({ status: 200, description: "Group details with views" })
  async findOne(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.findOne(id, userId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a view group (rename)" })
  @ApiResponse({ status: 200, description: "Updated group" })
  async update(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomOrderViewGroupDto,
  ) {
    return this.service.update(id, userId, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a view group (cascades to views)" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, userId);
  }
}
