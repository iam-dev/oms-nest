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
  BadRequestException,
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
import { CurrentUserId } from "../auth/decorators/current-user-id.decorator";

@ApiTags("Custom Order Cell Overrides")
@Controller({ path: "custom-order-cell-overrides", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomOrderCellOverrideController {
  constructor(private readonly service: CustomOrderCellOverrideService) {}

  @Post()
  @ApiOperation({ summary: "Upsert a single cell override" })
  @ApiResponse({ status: 201, description: "Override upserted" })
  async upsert(
    @CurrentUserId() userId: number,
    @Body() dto: CreateCellOverrideDto,
  ) {
    return this.service.upsert(userId, dto);
  }

  @Put("bulk")
  @ApiOperation({ summary: "Bulk upsert cell overrides" })
  @ApiResponse({ status: 200, description: "Overrides upserted" })
  async bulkUpsert(
    @CurrentUserId() userId: number,
    @Body() dto: BulkUpsertCellOverrideDto,
  ) {
    return this.service.bulkUpsert(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "Get cell overrides for current user" })
  @ApiQuery({
    name: "orderIds",
    required: false,
    description: "Comma-separated integer order IDs",
  })
  @ApiResponse({ status: 200, description: "List of overrides" })
  async findByUser(
    @CurrentUserId() userId: number,
    @Query("orderIds") orderIdsStr?: string,
  ) {
    let orderIds: number[] | undefined;

    if (orderIdsStr) {
      // BE-010: filter out non-integer values to prevent NaN from propagating
      const parsed = orderIdsStr
        .split(",")
        .map((seg) => parseInt(seg.trim(), 10));
      orderIds = parsed.filter(Number.isInteger);

      if (orderIds.length === 0) {
        throw new BadRequestException(
          "orderIds must be a comma-separated list of integers",
        );
      }
    }

    return this.service.findByUser(userId, orderIds);
  }

  @Get("order/:orderId")
  @ApiOperation({ summary: "Get overrides for a specific order" })
  @ApiResponse({ status: 200, description: "List of overrides for order" })
  async findByOrder(
    @CurrentUserId() userId: number,
    @Param("orderId", ParseIntPipe) orderId: number,
  ) {
    return this.service.findByOrder(userId, orderId);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a cell override by ID" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @CurrentUserId() userId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, userId);
  }

  @Delete("order/:orderId/column/:columnKey")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete override by order and column" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async removeByOrderAndColumn(
    @CurrentUserId() userId: number,
    @Param("orderId", ParseIntPipe) orderId: number,
    @Param("columnKey") columnKey: string,
  ) {
    return this.service.removeByOrderAndColumn(userId, orderId, columnKey);
  }
}
