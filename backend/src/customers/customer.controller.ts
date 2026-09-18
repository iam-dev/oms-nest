import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  UnprocessableEntityException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { DataSource } from "typeorm";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
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

type AuthenticatedRequest = {
  user?: { legacyId?: number; role?: { id: number; name: string } };
};

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
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CustomerController {
  constructor(
    private readonly customerService: CustomerService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Resolve the fitters.id of the logged-in user when they are a fitter.
   * Returns undefined for admins/supervisors (no scoping applies).
   */
  private async resolveFitterIdForUser(
    req?: AuthenticatedRequest,
  ): Promise<number | undefined> {
    if (req?.user?.role?.id !== RoleEnum.fitter || !req.user.legacyId) {
      return undefined;
    }
    const fitterRow = await this.dataSource.query(
      "SELECT id FROM fitters WHERE user_id = $1 LIMIT 1",
      [req.user.legacyId],
    );
    return fitterRow[0]?.id || undefined;
  }

  /**
   * Fitters may only touch customers inside their scope (assigned to them or
   * with an order of theirs). Anything else is reported as missing, exactly as
   * the scoped list would, so ids can't be probed. Admins/supervisors skip this.
   */
  private async assertFitterCanSee(
    id: number,
    req?: AuthenticatedRequest,
  ): Promise<void> {
    const ownFitterId = await this.resolveFitterIdForUser(req);
    if (ownFitterId === undefined) {
      return;
    }
    const visible = await this.customerService.isVisibleToFitter(
      id.toString(),
      ownFitterId,
    );
    if (!visible) {
      throw new NotFoundException("Customer not found");
    }
  }

  private forbidFitters(req?: AuthenticatedRequest): void {
    if (req?.user?.role?.id === RoleEnum.fitter) {
      throw new ForbiddenException("Not available to fitters");
    }
  }

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
    status: 422,
    description: "Invalid input data, or no fitterId supplied by an admin",
  })
  @ApiResponse({
    status: 409,
    description: "Customer with this email already exists for this fitter",
  })
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto> {
    // A fitter's new customer always belongs to them (legacy locks the Fitter
    // LOV to the logged-in fitter), so ignore whatever the client sent.
    const ownFitterId = await this.resolveFitterIdForUser(req);
    if (ownFitterId !== undefined) {
      createCustomerDto = { ...createCustomerDto, fitterId: ownFitterId };
    }
    // customers.fitter_id is NOT NULL and a 0 makes the row invisible to every
    // fitter, so admins/supervisors must pick one — same as the legacy Add form.
    if (!createCustomerDto.fitterId) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { fitterId: "fitterId is required" },
      });
    }
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
    @Req() req?: AuthenticatedRequest,
  ): Promise<{ data: CustomerDto[]; total: number; pages: number }> {
    // Auto-scope fitter users to their own customers (assigned or via orders)
    const scopedFitterId = await this.resolveFitterIdForUser(req);

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
      scopedFitterId,
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
  async findWithoutFitter(
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto[]> {
    this.forbidFitters(req);
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
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto[]> {
    const ownFitterId = await this.resolveFitterIdForUser(req);
    if (ownFitterId !== undefined && ownFitterId !== fitterId) {
      throw new ForbiddenException("Fitters can only list their own customers");
    }
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
  async findOne(
    @Param("id", ParseIntPipe) id: number,
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto> {
    await this.assertFitterCanSee(id, req);
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
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto> {
    await this.assertFitterCanSee(id, req);
    if (req?.user?.role?.id === RoleEnum.fitter) {
      // A fitter can't hand a customer to another fitter.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { fitterId: _ignored, ...rest } = updateCustomerDto;
      updateCustomerDto = rest;
    }
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
  async remove(
    @Param("id", ParseIntPipe) id: number,
    @Req() req?: AuthenticatedRequest,
  ): Promise<void> {
    await this.assertFitterCanSee(id, req);
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
    @Req() req?: AuthenticatedRequest,
  ): Promise<CustomerDto> {
    this.forbidFitters(req);
    return this.customerService.assignFitter(customerId.toString(), fitterId);
  }
}
