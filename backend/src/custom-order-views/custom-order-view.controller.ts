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
import { CustomOrderViewService } from "./custom-order-view.service";
import { CreateCustomOrderViewDto } from "./dto/create-custom-order-view.dto";
import { UpdateCustomOrderViewDto } from "./dto/update-custom-order-view.dto";

@ApiTags("Custom Order Views")
@Controller({ path: "custom-order-views", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomOrderViewController {
  constructor(private readonly service: CustomOrderViewService) {}

  private getUserId(req: { user?: { legacyId?: number } }): number {
    const id = req.user?.legacyId;
    if (!id)
      throw new UnauthorizedException("User legacyId not found in JWT payload");
    return id;
  }

  @Post()
  @ApiOperation({ summary: "Create a custom order view" })
  @ApiResponse({ status: 201, description: "View created" })
  async create(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: CreateCustomOrderViewDto,
  ) {
    return this.service.create(this.getUserId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "List all custom order views for current user" })
  @ApiResponse({ status: 200, description: "List of views" })
  async findAll(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findAll(this.getUserId(req));
  }

  @Get("default")
  @ApiOperation({ summary: "Get the default view for current user" })
  @ApiResponse({ status: 200, description: "Default view or null" })
  async findDefault(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findDefault(this.getUserId(req));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific custom order view" })
  @ApiResponse({ status: 200, description: "View details" })
  async findOne(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.findOne(id, this.getUserId(req));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a custom order view" })
  @ApiResponse({ status: 200, description: "Updated view" })
  async update(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateCustomOrderViewDto,
  ) {
    return this.service.update(id, this.getUserId(req), dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a custom order view" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, this.getUserId(req));
  }
}
