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
import { ReportSavedFilterService } from "./report-saved-filter.service";
import { CreateReportSavedFilterDto } from "./dto/create-report-saved-filter.dto";
import { UpdateReportSavedFilterDto } from "./dto/update-report-saved-filter.dto";

@ApiTags("Report Saved Filters")
@Controller({ path: "report-saved-filters", version: "1" })
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class ReportSavedFilterController {
  constructor(private readonly service: ReportSavedFilterService) {}

  private getUserId(req: { user?: { legacyId?: number } }): number {
    const id = req.user?.legacyId;
    if (!id)
      throw new UnauthorizedException("User legacyId not found in JWT payload");
    return id;
  }

  @Post()
  @ApiOperation({ summary: "Create a saved report filter" })
  @ApiResponse({ status: 201, description: "Saved filter created" })
  async create(
    @Req() req: { user?: { legacyId?: number } },
    @Body() dto: CreateReportSavedFilterDto,
  ) {
    return this.service.create(this.getUserId(req), dto);
  }

  @Get()
  @ApiOperation({ summary: "List all saved report filters for current user" })
  @ApiResponse({ status: 200, description: "List of saved filters" })
  async findAll(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findAll(this.getUserId(req));
  }

  @Get("default")
  @ApiOperation({ summary: "Get the default saved filter for current user" })
  @ApiResponse({ status: 200, description: "Default filter or null" })
  async findDefault(@Req() req: { user?: { legacyId?: number } }) {
    return this.service.findDefault(this.getUserId(req));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a saved report filter" })
  @ApiResponse({ status: 200, description: "Updated saved filter" })
  async update(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateReportSavedFilterDto,
  ) {
    return this.service.update(id, this.getUserId(req), dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a saved report filter" })
  @ApiResponse({ status: 204, description: "Deleted" })
  async remove(
    @Req() req: { user?: { legacyId?: number } },
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.service.remove(id, this.getUserId(req));
  }
}
