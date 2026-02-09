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
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { CustomerService } from "./customer.service";
import { CreateCustomerDto } from "./dto/create-customer.dto";
import { UpdateCustomerDto } from "./dto/update-customer.dto";
import { CustomerDto } from "./dto/customer.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLog } from "../audit-logging/decorators";

/**
 * Customer REST API Controller
 *
 * Handles HTTP requests for customer management operations
 * Uses integer IDs to match PostgreSQL schema
 */
@ApiTags("Customers")
@Controller({
  path: "customers",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  @AuditLog({ entity: "Customer" })
  @ApiOperation({
    summary: "Create a new customer",
    description: "Creates a new customer with the provided information",
  })
  @ApiResponse({
    status: 201,
    description: "Customer created successfully",
    type: CustomerDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: 409,
    description: "Customer with this email already exists for this fitter",
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customerService.create(createCustomerDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all customers",
    description:
      "Retrieve all customers with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Customers retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/CustomerDto" },
        },
        total: { type: "number" },
        pages: { type: "number" },
      },
    },
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search across name, email, city, country, and ID",
  })
  @ApiQuery({
    name: "id",
    required: false,
    type: Number,
    description: "Filter by exact customer ID",
  })
  @ApiQuery({ name: "name", required: false, type: String })
  @ApiQuery({ name: "email", required: false, type: String })
  @ApiQuery({ name: "city", required: false, type: String })
  @ApiQuery({ name: "country", required: false, type: String })
  @ApiQuery({ name: "fitterId", required: false, type: Number })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("search") search?: string,
    @Query("id") id?: number,
    @Query("name") name?: string,
    @Query("email") email?: string,
    @Query("city") city?: string,
    @Query("country") country?: string,
    @Query("fitterId") fitterId?: number,
  ): Promise<{ data: CustomerDto[]; total: number; pages: number }> {
    return this.customerService.findAll(
      page ? +page : undefined,
      limit ? +limit : undefined,
      name,
      email,
      city,
      country,
      fitterId ? +fitterId : undefined,
      search,
      id ? +id : undefined,
    );
  }

  @Get("without-fitter")
  @ApiOperation({
    summary: "Get customers without fitter",
    description:
      "Retrieve all active customers that do not have a fitter assigned",
  })
  @ApiResponse({
    status: 200,
    description: "Customers without fitter retrieved successfully",
    type: [CustomerDto],
  })
  async findWithoutFitter(): Promise<CustomerDto[]> {
    return this.customerService.findWithoutFitter();
  }

  @Get("fitter/:fitterId")
  @ApiOperation({
    summary: "Get customers by fitter",
    description: "Retrieve all customers assigned to a specific fitter",
  })
  @ApiParam({
    name: "fitterId",
    description: "Fitter ID (integer)",
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: "Customers retrieved successfully",
    type: [CustomerDto],
  })
  async findByFitter(
    @Param("fitterId", ParseIntPipe) fitterId: number,
  ): Promise<CustomerDto[]> {
    return this.customerService.findByFitter(fitterId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get customer by ID",
    description: "Retrieve a specific customer by their unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Customer ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Customer found",
    type: CustomerDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<CustomerDto> {
    return this.customerService.findOne(id.toString());
  }

  @Patch(":id")
  @AuditLog({ entity: "Customer" })
  @ApiOperation({
    summary: "Update customer",
    description: "Update customer information",
  })
  @ApiParam({
    name: "id",
    description: "Customer ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Customer updated successfully",
    type: CustomerDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  @ApiResponse({
    status: 409,
    description: "Email conflict with existing customer",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCustomerDto: UpdateCustomerDto,
  ): Promise<CustomerDto> {
    return this.customerService.update(id.toString(), updateCustomerDto);
  }

  @Delete(":id")
  @AuditLog({ entity: "Customer" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete customer",
    description: "Soft delete a customer (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Customer ID (integer)",
    example: 12345,
  })
  @ApiResponse({
    status: 204,
    description: "Customer deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.customerService.remove(id.toString());
  }

  @Post(":customerId/assign-fitter/:fitterId")
  @AuditLog({
    entity: "Customer",
    action: "assign_fitter",
    idParam: "customerId",
  })
  @ApiOperation({
    summary: "Assign fitter to customer",
    description: "Assign a fitter to a customer for management",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID (integer)",
    example: 12345,
  })
  @ApiParam({
    name: "fitterId",
    description: "Fitter ID (integer)",
    example: 67890,
  })
  @ApiResponse({
    status: 200,
    description: "Fitter assigned successfully",
    type: CustomerDto,
  })
  @ApiResponse({
    status: 404,
    description: "Customer not found",
  })
  async assignFitter(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Param("fitterId", ParseIntPipe) fitterId: number,
  ): Promise<CustomerDto> {
    return this.customerService.assignFitter(customerId.toString(), fitterId);
  }
}
