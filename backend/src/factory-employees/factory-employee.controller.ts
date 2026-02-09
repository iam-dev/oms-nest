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
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiCookieAuth,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { FactoryEmployeeService } from "./factory-employee.service";
import { FactoryEmployeeDtoMapper } from "./mappers/factory-employee-dto.mapper";
import { CreateFactoryEmployeeDto } from "./dto/create-factory-employee.dto";
import { UpdateFactoryEmployeeDto } from "./dto/update-factory-employee.dto";
import { QueryFactoryEmployeeDto } from "./dto/query-factory-employee.dto";
import { FactoryEmployeeDto } from "./dto/factory-employee.dto";

/**
 * Factory Employee Controller
 * Handles HTTP requests for factory employee operations
 */
@ApiTags("Factory Employees")
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.factory)
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller({
  path: "factory-employees",
  version: "1",
})
export class FactoryEmployeeController {
  constructor(
    private readonly factoryEmployeeService: FactoryEmployeeService,
  ) {}

  /**
   * Create a new factory employee
   */
  @Post()
  @ApiOperation({
    summary: "Create factory employee",
    description: "Create a new factory employee with the provided details",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Factory employee created successfully",
    type: FactoryEmployeeDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Employee with same name already exists in factory",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async create(
    @Body() createFactoryEmployeeDto: CreateFactoryEmployeeDto,
  ): Promise<FactoryEmployeeDto> {
    const factoryEmployee = await this.factoryEmployeeService.create(
      createFactoryEmployeeDto,
    );
    const dto = FactoryEmployeeDtoMapper.toDto(factoryEmployee);
    if (!dto) {
      throw new Error("Failed to map factory employee to DTO");
    }
    return dto;
  }

  /**
   * Get all factory employees with filtering and pagination
   */
  @Get()
  @ApiOperation({
    summary: "Get factory employees",
    description:
      "Retrieve factory employees with optional filtering and pagination",
  })
  @ApiQuery({
    name: "factoryId",
    required: false,
    type: "integer",
    description: "Filter by factory ID",
  })
  @ApiQuery({
    name: "name",
    required: false,
    type: "string",
    description: "Filter by employee name (partial match)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: "integer",
    description: "Number of records to return (1-100)",
    example: 20,
  })
  @ApiQuery({
    name: "offset",
    required: false,
    type: "integer",
    description: "Number of records to skip",
    example: 0,
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: "integer",
    description: "Page number (alternative to offset)",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Factory employees retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/FactoryEmployeeDto" },
        },
        total: { type: "number", description: "Total number of records" },
        page: { type: "number", description: "Current page number" },
        limit: { type: "number", description: "Records per page" },
        totalPages: { type: "number", description: "Total number of pages" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async findAll(@Query() query: QueryFactoryEmployeeDto) {
    const result = await this.factoryEmployeeService.findAll(query);

    return {
      data: FactoryEmployeeDtoMapper.toDtoArray(result.data),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * Get factory employee by ID
   */
  @Get(":id")
  @ApiOperation({
    summary: "Get factory employee by ID",
    description: "Retrieve a specific factory employee by their ID",
  })
  @ApiParam({
    name: "id",
    type: "integer",
    description: "Factory employee ID",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Factory employee retrieved successfully",
    type: FactoryEmployeeDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Factory employee not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<FactoryEmployeeDto> {
    const factoryEmployee = await this.factoryEmployeeService.findOne(id);
    const dto = FactoryEmployeeDtoMapper.toDto(factoryEmployee);
    if (!dto) {
      throw new Error("Failed to map factory employee to DTO");
    }
    return dto;
  }

  /**
   * Get factory employees by factory ID
   */
  @Get("factory/:factoryId")
  @ApiOperation({
    summary: "Get employees by factory ID",
    description: "Retrieve all employees belonging to a specific factory",
  })
  @ApiParam({
    name: "factoryId",
    type: "integer",
    description: "Factory ID",
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Factory employees retrieved successfully",
    type: [FactoryEmployeeDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid factory ID",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async findByFactory(
    @Param("factoryId", ParseIntPipe) factoryId: number,
  ): Promise<FactoryEmployeeDto[]> {
    const factoryEmployees =
      await this.factoryEmployeeService.findByFactoryId(factoryId);
    return FactoryEmployeeDtoMapper.toDtoArray(factoryEmployees);
  }

  /**
   * Update factory employee
   */
  @Patch(":id")
  @ApiOperation({
    summary: "Update factory employee",
    description: "Update factory employee details",
  })
  @ApiParam({
    name: "id",
    type: "integer",
    description: "Factory employee ID",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Factory employee updated successfully",
    type: FactoryEmployeeDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Factory employee not found",
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Employee with same name already exists in factory",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateFactoryEmployeeDto: UpdateFactoryEmployeeDto,
  ): Promise<FactoryEmployeeDto> {
    const factoryEmployee = await this.factoryEmployeeService.update(
      id,
      updateFactoryEmployeeDto,
    );
    const dto = FactoryEmployeeDtoMapper.toDto(factoryEmployee);
    if (!dto) {
      throw new Error("Failed to map factory employee to DTO");
    }
    return dto;
  }

  /**
   * Delete factory employee
   */
  @Delete(":id")
  @ApiOperation({
    summary: "Delete factory employee",
    description: "Delete a factory employee by ID",
  })
  @ApiParam({
    name: "id",
    type: "integer",
    description: "Factory employee ID",
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: "Factory employee deleted successfully",
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: "Factory employee not found",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    await this.factoryEmployeeService.remove(id);
  }

  /**
   * Get employee count by factory
   */
  @Get("factory/:factoryId/count")
  @ApiOperation({
    summary: "Get employee count by factory",
    description: "Get the total number of employees in a specific factory",
  })
  @ApiParam({
    name: "factoryId",
    type: "integer",
    description: "Factory ID",
    example: 123,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Employee count retrieved successfully",
    schema: {
      type: "object",
      properties: {
        factoryId: { type: "number" },
        count: { type: "number" },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid factory ID",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async getEmployeeCountByFactory(
    @Param("factoryId", ParseIntPipe) factoryId: number,
  ): Promise<{ factoryId: number; count: number }> {
    const count =
      await this.factoryEmployeeService.getEmployeeCountByFactory(factoryId);
    return { factoryId, count };
  }

  /**
   * Bulk transfer employees to another factory
   */
  @Post("bulk-transfer")
  @ApiOperation({
    summary: "Bulk transfer employees",
    description: "Transfer multiple employees to another factory",
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Employees transferred successfully",
    type: [FactoryEmployeeDto],
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "Unauthorized access",
  })
  async bulkTransfer(
    @Body()
    body: {
      employeeIds: number[];
      newFactoryId: number;
    },
  ): Promise<FactoryEmployeeDto[]> {
    const { employeeIds, newFactoryId } = body;
    const transferredEmployees =
      await this.factoryEmployeeService.bulkTransferToFactory(
        employeeIds,
        newFactoryId,
      );
    return FactoryEmployeeDtoMapper.toDtoArray(transferredEmployees);
  }
}
