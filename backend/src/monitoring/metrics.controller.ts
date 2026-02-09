import { Controller, Get, Header, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { MetricsService } from "./metrics.service";

@ApiTags("monitoring")
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Header("Content-Type", "text/plain")
  @ApiOperation({ summary: "Get Prometheus metrics" })
  @ApiResponse({
    status: 200,
    description: "Prometheus metrics in text format",
    content: {
      "text/plain": {
        schema: {
          type: "string",
        },
      },
    },
  })
  async getMetrics(): Promise<string> {
    return await this.metricsService.getMetrics();
  }
}
