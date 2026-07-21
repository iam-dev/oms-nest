import {
  Controller,
  Get,
  Query,
  UseGuards,
  Logger,
  HttpException,
  HttpStatus,
  ForbiddenException,
  Request,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { SaddleStockService } from "./saddle-stock.service";
import { QuerySaddleStockDto } from "./dto/query-saddle-stock.dto";

@ApiTags("Saddle Stock")
@Controller({
  path: "saddle-stock",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class SaddleStockController {
  private readonly logger = new Logger(SaddleStockController.name);

  constructor(private readonly saddleStockService: SaddleStockService) {}

  @Get()
  async getSaddleStock(
    @Query() query: QuerySaddleStockDto,
    @Request() req: any,
  ) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new HttpException("Unauthorized", HttpStatus.UNAUTHORIZED);
      }

      const userRoleId = req.user?.role?.id;

      const type: "my" | "available" | "all" =
        query.type === "available"
          ? "available"
          : query.type === "all"
            ? "all"
            : "my";

      if (
        (type === "my" || type === "available") &&
        userRoleId !== RoleEnum.fitter
      ) {
        throw new ForbiddenException(
          "Saddle stock my/available is fitter-only",
        );
      }

      if (
        type === "all" &&
        ![RoleEnum.admin, RoleEnum.supervisor].includes(userRoleId)
      ) {
        throw new ForbiddenException(
          "All saddle stock requires admin/supervisor role",
        );
      }
      const page = this.parsePositiveInt(query.page, 1);
      const limit = Math.min(this.parsePositiveInt(query.limit, 30), 100);
      const search = query.search ? String(query.search).trim() : undefined;

      this.logger.log(
        `Fetching ${type} saddle stock for user ${userId}, page ${page}`,
      );

      const result = await this.saddleStockService.getSaddleStock(
        type,
        userId,
        page,
        limit,
        search,
        userRoleId,
      );

      return {
        data: result.data,
        total: result.total,
        pages: result.pages,
        page: result.page,
        limit: limit,
        hasNext: result.page < result.pages,
        hasPrev: result.page > 1,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error("Failed to fetch saddle stock", error);
      throw new HttpException(
        {
          message: "Failed to fetch saddle stock",
          timestamp: new Date().toISOString(),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private parsePositiveInt(value: any, defaultValue: number): number {
    if (value === undefined || value === null) return defaultValue;
    const parsed = parseInt(String(value), 10);
    return isNaN(parsed) || parsed <= 0 ? defaultValue : parsed;
  }
}
