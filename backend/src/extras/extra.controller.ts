import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiCookieAuth, ApiQuery } from "@nestjs/swagger";
import { ExtraService } from "./extra.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { CreateExtraDto } from "./dto/create-extra.dto";
import { UpdateExtraDto } from "./dto/update-extra.dto";
import { AuditLog } from "../audit-logging/decorators";

@ApiTags("Extras")
@Controller({
  path: "extras",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class ExtraController {
  constructor(private readonly extraService: ExtraService) {}

  @Post()
  @AuditLog({ entity: "Extra" })
  async create(@Body() createExtraDto: CreateExtraDto) {
    return this.extraService.create(createExtraDto);
  }

  @Get()
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "search", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
  ) {
    return this.extraService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      search,
    );
  }

  @Get("active")
  async findActiveExtras() {
    return this.extraService.findActiveExtras();
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.extraService.findOne(id);
  }

  @Patch(":id")
  @AuditLog({ entity: "Extra" })
  async update(
    @Param("id") id: string,
    @Body() updateExtraDto: UpdateExtraDto,
  ) {
    return this.extraService.update(id, updateExtraDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "Extra" })
  async remove(@Param("id") id: string) {
    return this.extraService.remove(id);
  }
}
