import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { PresetService } from "./preset.service";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLog } from "../audit-logging/decorators";

@ApiTags("Presets")
@Controller({
  path: "presets",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class PresetController {
  constructor(private readonly presetService: PresetService) {}

  @Post()
  @AuditLog({ entity: "Preset" })
  async create(@Body() createPresetDto: any) {
    return this.presetService.create(createPresetDto);
  }

  @Get()
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
  ) {
    return this.presetService.findAll(
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
      search,
    );
  }

  @Get(":id")
  async findOne(@Param("id", ParseIntPipe) id: number) {
    return this.presetService.findOne(id);
  }

  @Patch(":id")
  @AuditLog({ entity: "Preset" })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updatePresetDto: any,
  ) {
    return this.presetService.update(id, updatePresetDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "Preset" })
  async remove(@Param("id", ParseIntPipe) id: number) {
    return this.presetService.remove(id);
  }
}
