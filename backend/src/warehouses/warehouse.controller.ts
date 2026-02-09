import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { WarehouseService } from "./warehouse.service";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpdateWarehouseDto } from "./dto/update-warehouse.dto";
import { QueryWarehouseDto } from "./dto/query-warehouse.dto";
import { Warehouse } from "./warehouse.entity";

@ApiTags("Warehouses")
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller({
  path: "warehouses",
  version: "1",
})
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @ApiOperation({ summary: "Create a new warehouse" })
  @ApiResponse({
    status: 201,
    description: "Warehouse created successfully",
    type: Warehouse,
  })
  create(@Body() createWarehouseDto: CreateWarehouseDto): Promise<Warehouse> {
    return this.warehouseService.create(createWarehouseDto);
  }

  @Get()
  @ApiOperation({ summary: "Get all warehouses with filtering and pagination" })
  @ApiResponse({
    status: 200,
    description: "List of warehouses",
  })
  findAll(@Query() query: QueryWarehouseDto) {
    return this.warehouseService.findAll(query);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a warehouse by ID" })
  @ApiParam({ name: "id", description: "Warehouse UUID" })
  @ApiResponse({
    status: 200,
    description: "Warehouse details",
    type: Warehouse,
  })
  @ApiResponse({
    status: 404,
    description: "Warehouse not found",
  })
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<Warehouse> {
    return this.warehouseService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a warehouse" })
  @ApiParam({ name: "id", description: "Warehouse UUID" })
  @ApiResponse({
    status: 200,
    description: "Warehouse updated successfully",
    type: Warehouse,
  })
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() updateWarehouseDto: UpdateWarehouseDto,
  ): Promise<Warehouse> {
    return this.warehouseService.update(id, updateWarehouseDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Soft delete a warehouse" })
  @ApiParam({ name: "id", description: "Warehouse UUID" })
  @ApiResponse({
    status: 200,
    description: "Warehouse deleted successfully",
  })
  remove(@Param("id", ParseUUIDPipe) id: string): Promise<void> {
    return this.warehouseService.remove(id);
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restore a soft-deleted warehouse" })
  @ApiParam({ name: "id", description: "Warehouse UUID" })
  @ApiResponse({
    status: 200,
    description: "Warehouse restored successfully",
    type: Warehouse,
  })
  restore(@Param("id", ParseUUIDPipe) id: string): Promise<Warehouse> {
    return this.warehouseService.restore(id);
  }
}
