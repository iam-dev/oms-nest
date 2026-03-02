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
  Req,
  UnauthorizedException,
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

@ApiTags("Custom Order View Groups")
@Controller({ path: "custom-order-view-groups", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomOrderViewGroupController {
  constructor(private readonly service: CustomOrderViewGroupService) {}

  private getUserId(req: { user?: { legacyId?: number } }): number {
    const id = req.user?.legacyId;
    if (!id)
      throw new UnauthorizedException("User legacyId not found in JWT payload");
    return id;
  }

  @Post()
  @ApiOperation({ summary: "Create a custom order view group" })
  @ApiResponse({ status: 201, description: "Group created" })
  async create(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: CreateCustomOrderViewGroupDto,
  ) {
    return this.service.create(this.getUserId(req), dto);
  }

  @Get()
  @ApiOperation({
    summary: "List all view groups with nested views for current user",
  })
  @ApiResponse({ status: 200, description: "List of groups with views" })
  async findAll(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findAllWithViews(this.getUserId(req));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific view group with its views" })
  @ApiResponse({ status: 200, description: "Group details with views" })
  async findOne(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.findOne(id, this.getUserId(req));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a view group (rename)" })
  @ApiResponse({ status: 200, description: "Updated group" })
  async update(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomOrderViewGroupDto,
  ) {
    return this.service.update(id, this.getUserId(req), dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a view group (cascades to views)" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, this.getUserId(req));
  }
}
