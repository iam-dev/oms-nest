import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Delete,
  Query,
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
  ApiQuery,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { CustomOrderCellOverrideService } from "./custom-order-cell-override.service";
import { CreateCellOverrideDto } from "./dto/create-cell-override.dto";
import { BulkUpsertCellOverrideDto } from "./dto/bulk-upsert-cell-override.dto";

@ApiTags("Custom Order Cell Overrides")
@Controller({ path: "custom-order-cell-overrides", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomOrderCellOverrideController {
  constructor(private readonly service: CustomOrderCellOverrideService) {}

  private getUserId(req: { user?: { legacyId?: number } }): number {
    const id = req.user?.legacyId;
    if (!id)
      throw new UnauthorizedException("User legacyId not found in JWT payload");
    return id;
  }

  @Post()
  @ApiOperation({ summary: "Upsert a single cell override" })
  @ApiResponse({ status: 201, description: "Override upserted" })
  async upsert(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: CreateCellOverrideDto,
  ) {
    return this.service.upsert(this.getUserId(req), dto);
  }

  @Put("bulk")
  @ApiOperation({ summary: "Bulk upsert cell overrides" })
  @ApiResponse({ status: 200, description: "Overrides upserted" })
  async bulkUpsert(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: BulkUpsertCellOverrideDto,
  ) {
    return this.service.bulkUpsert(this.getUserId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "Get cell overrides for current user" })
  @ApiQuery({
    name: "orderIds",
    required: false,
    description: "Comma-separated order IDs",
  })
  @ApiResponse({ status: 200, description: "List of overrides" })
  async findByUser(
    @Req() req: { user?: { legacyId?: number } },
    @Query("orderIds") orderIdsStr?: string,
  ) {
    const orderIds = orderIdsStr
      ? orderIdsStr.split(",").map((id) => parseInt(id.trim(), 10))
      : undefined;
    return this.service.findByUser(this.getUserId(req), orderIds);
  }

  @Get("order/:orderId")
  @ApiOperation({ summary: "Get overrides for a specific order" })
  @ApiResponse({ status: 200, description: "List of overrides for order" })
  async findByOrder(
    @Req() req: { user?: { legacyId?: number } },
    @Param("orderId", ParseIntPipe) orderId: number,
  ) {
    return this.service.findByOrder(this.getUserId(req), orderId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a cell override by ID" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, this.getUserId(req));
  }

  @Delete("order/:orderId/column/:columnKey")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete override by order and column" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async removeByOrderAndColumn(
    @Req() req: { user?: { legacyId?: number } },
    @Param("orderId", ParseIntPipe) orderId: number,
    @Param("columnKey") columnKey: string,
  ) {
    return this.service.removeByOrderAndColumn(
      this.getUserId(req),
      orderId,
      columnKey,
    );
  }
}
