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
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { OrderService } from "./order.service";
import { OrderSearchService } from "./order-search.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
// QueryOrderDto may be used for future query parameter validation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { QueryOrderDto } from "./dto/query-order.dto";
import { OrderSearchDto } from "./dto/order-search.dto";
import { OrderDto } from "./dto/order.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLog } from "../audit-logging/decorators";

/**
 * Order REST API Controller
 *
 * Handles HTTP requests for order management operations.
 * Provides comprehensive order lifecycle management endpoints.
 */
@ApiTags("Orders")
@Controller({
  path: "orders",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly orderSearchService: OrderSearchService,
  ) {}

  @Post()
  @AuditLog({ entity: "Order", action: "create_order" })
  @ApiOperation({
    summary: "Create a new order",
    description:
      "Creates a new order with the provided specifications and details",
  })
  @ApiResponse({
    status: 201,
    description: "Order created successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiResponse({
    status: 409,
    description: "Order with this order number already exists",
  })
  async create(@Body() createOrderDto: CreateOrderDto): Promise<OrderDto> {
    return this.orderService.create(createOrderDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all orders",
    description: "Retrieve all orders with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Orders retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/OrderDto" },
        },
        total: { type: "number" },
        pages: { type: "number" },
      },
    },
  })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "fitterId", required: false, type: Number })
  @ApiQuery({ name: "customerId", required: false, type: Number })
  @ApiQuery({ name: "factoryId", required: false, type: Number })
  @ApiQuery({ name: "status", required: false, type: String })
  async findAll(
    @Query("page") page?: number,
    @Query("limit") limit?: number,
    @Query("fitterId") fitterId?: number,
    @Query("customerId") customerId?: number,
    @Query("factoryId") factoryId?: number,
    @Query("status") status?: string,
  ): Promise<{ data: OrderDto[]; total: number; pages: number }> {
    return this.orderService.findAll(
      page,
      limit,
      fitterId,
      customerId,
      factoryId,
      status,
    );
  }

  @Get("search")
  @ApiOperation({
    summary: "Advanced order search",
    description:
      "Search orders with multiple criteria including customer name, order ID, seat size, urgency, etc. " +
      "Optimized for production scale (<100ms response time for 2.9M records)",
  })
  @ApiResponse({
    status: 200,
    description: "Search results retrieved successfully",
    schema: {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: { $ref: "#/components/schemas/OrderDto" },
        },
        total: {
          type: "number",
          description: "Total number of matching orders",
        },
        page: {
          type: "number",
          description: "Current page number (1-based)",
        },
        limit: {
          type: "number",
          description: "Number of orders per page",
        },
        hasNext: {
          type: "boolean",
          description: "Whether there are more pages available",
        },
        hasPrev: {
          type: "boolean",
          description: "Whether there are previous pages",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid search parameters",
  })
  async searchOrders(@Query() searchDto: OrderSearchDto): Promise<{
    orders: OrderDto[];
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
    hasPrev: boolean;
  }> {
    return this.orderSearchService.searchOrders(searchDto);
  }

  @Get("search/suggestions")
  @ApiOperation({
    summary: "Get search suggestions",
    description:
      "Get autocomplete suggestions for customer names or order numbers",
  })
  @ApiQuery({
    name: "type",
    enum: ["customer", "orderNumber"],
    description: "Type of suggestion to retrieve",
  })
  @ApiQuery({
    name: "query",
    description: "Partial search term (minimum 2 characters)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of suggestions (default: 10)",
  })
  @ApiResponse({
    status: 200,
    description: "Search suggestions retrieved successfully",
    schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  })
  async getSearchSuggestions(
    @Query("type") type: "customer" | "orderNumber",
    @Query("query") query: string,
    @Query("limit") limit?: number,
  ): Promise<{ suggestions: string[] }> {
    const suggestions = await this.orderSearchService.getSearchSuggestions(
      type,
      query,
      limit ? parseInt(limit.toString()) : 10,
    );
    return { suggestions };
  }

  @Get("search/stats")
  @ApiOperation({
    summary: "Get search statistics",
    description: "Get statistics for the current search criteria",
  })
  @ApiResponse({
    status: 200,
    description: "Search statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        totalMatching: { type: "number" },
        urgentCount: { type: "number" },
        statusBreakdown: {
          type: "object",
          additionalProperties: { type: "number" },
        },
        averageValue: { type: "number" },
      },
    },
  })
  async getSearchStats(@Query() searchDto: OrderSearchDto): Promise<{
    totalMatching: number;
    urgentCount: number;
    statusBreakdown: Record<string, number>;
    averageValue: number;
  }> {
    return this.orderSearchService.getSearchStats(searchDto);
  }

  @Get("urgent")
  @ApiOperation({
    summary: "Get urgent orders",
    description: "Retrieve all urgent orders that require immediate attention",
  })
  @ApiResponse({
    status: 200,
    description: "Urgent orders retrieved successfully",
    type: [OrderDto],
  })
  async findUrgent(): Promise<OrderDto[]> {
    return this.orderService.findUrgentOrders();
  }

  @Get("overdue")
  @ApiOperation({
    summary: "Get overdue orders",
    description:
      "Retrieve all orders that are past their estimated delivery date",
  })
  @ApiResponse({
    status: 200,
    description: "Overdue orders retrieved successfully",
    type: [OrderDto],
  })
  async findOverdue(): Promise<OrderDto[]> {
    return this.orderService.findOverdueOrders();
  }

  @Get("production")
  @ApiOperation({
    summary: "Get orders in production",
    description: "Retrieve orders currently in production phase",
  })
  @ApiResponse({
    status: 200,
    description: "Production orders retrieved successfully",
    type: [OrderDto],
  })
  async findInProduction(): Promise<OrderDto[]> {
    return this.orderService.findOrdersInProduction();
  }

  @Get("production/schedule")
  @ApiOperation({
    summary: "Get orders for production scheduling",
    description:
      "Retrieve orders optimized for production scheduling by priority and urgency",
  })
  @ApiQuery({
    name: "limit",
    description: "Maximum number of orders to return",
    example: 50,
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: "Production schedule retrieved successfully",
    type: [OrderDto],
  })
  async findForProduction(@Query("limit") limit?: number): Promise<OrderDto[]> {
    return this.orderService.findOrdersForProduction(limit);
  }

  @Get("requiring-deposit")
  @ApiOperation({
    summary: "Get orders requiring deposit",
    description: "Retrieve orders that still require deposit payments",
  })
  @ApiResponse({
    status: 200,
    description: "Orders requiring deposit retrieved successfully",
    type: [OrderDto],
  })
  async findRequiringDeposit(): Promise<OrderDto[]> {
    return this.orderService.findOrdersRequiringDeposit();
  }

  @Get("stats")
  @ApiOperation({
    summary: "Get order statistics",
    description:
      "Retrieve overall order statistics including counts and averages",
  })
  @ApiResponse({
    status: 200,
    description: "Order statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        totalOrders: { type: "number" },
        urgentOrders: { type: "number" },
        overdueOrders: { type: "number" },
        averageValue: { type: "number" },
        statusCounts: {
          type: "object",
          additionalProperties: { type: "number" },
          description: "Count of orders by status",
        },
      },
    },
  })
  async getStats(): Promise<{
    totalOrders: number;
    urgentOrders: number;
    overdueOrders: number;
    averageValue: number;
    statusCounts: Record<string, number>;
  }> {
    return this.orderService.getOrderStats();
  }

  @Get("customer/:customerId")
  @ApiOperation({
    summary: "Get orders by customer",
    description: "Retrieve all orders for a specific customer",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Customer orders retrieved successfully",
    type: [OrderDto],
  })
  async findByCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
  ): Promise<OrderDto[]> {
    return this.orderService.findByCustomerId(customerId);
  }

  @Get("customer/:customerId/summary")
  @ApiOperation({
    summary: "Get customer order summary",
    description: "Get order count and total value for a customer",
  })
  @ApiParam({
    name: "customerId",
    description: "Customer ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Customer order summary retrieved successfully",
    schema: {
      type: "object",
      properties: {
        orderCount: { type: "number" },
        totalValue: { type: "number" },
      },
    },
  })
  async getCustomerSummary(
    @Param("customerId", ParseIntPipe) customerId: number,
  ): Promise<{
    orderCount: number;
    totalValue: number;
  }> {
    return this.orderService.getCustomerOrderSummary(customerId);
  }

  @Get("fitter/:fitterId")
  @ApiOperation({
    summary: "Get orders by fitter",
    description: "Retrieve all orders assigned to a specific fitter",
  })
  @ApiParam({
    name: "fitterId",
    description: "Fitter ID",
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: "Fitter orders retrieved successfully",
    type: [OrderDto],
  })
  async findByFitter(
    @Param("fitterId", ParseIntPipe) fitterId: number,
  ): Promise<OrderDto[]> {
    return this.orderService.findByFitterId(fitterId);
  }

  @Get("factory/:factoryId")
  @ApiOperation({
    summary: "Get orders by factory",
    description: "Retrieve all orders assigned to a specific factory",
  })
  @ApiParam({
    name: "factoryId",
    description: "Factory ID",
    example: 456,
  })
  @ApiResponse({
    status: 200,
    description: "Factory orders retrieved successfully",
    type: [OrderDto],
  })
  async findByFactory(
    @Param("factoryId", ParseIntPipe) factoryId: number,
  ): Promise<OrderDto[]> {
    return this.orderService.findByFactoryId(factoryId);
  }

  @Get("number/:orderNumber")
  @ApiOperation({
    summary: "Get order by order number",
    description: "Retrieve a specific order by its order number",
  })
  @ApiParam({
    name: "orderNumber",
    description: "Order number",
    example: "ORD-2023-001234",
  })
  @ApiResponse({
    status: 200,
    description: "Order found",
    type: OrderDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async findByOrderNumber(
    @Param("orderNumber") orderNumber: string,
  ): Promise<OrderDto> {
    return this.orderService.findByOrderNumber(orderNumber);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get order by ID",
    description: "Retrieve a specific order by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Order found",
    type: OrderDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<OrderDto> {
    return this.orderService.findOne(id);
  }

  @Patch(":id")
  @AuditLog({
    entity: "Order",
    action: "update_order",
    trackStatusChange: true,
  })
  @ApiOperation({
    summary: "Update order",
    description:
      "Update order information including status, priority, and assignments",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Order updated successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
    @Req() req: any,
  ): Promise<OrderDto> {
    if (updateOrderDto.status !== undefined) {
      try {
        const current = await this.orderService.findOne(id);
        req.__auditContext = { previousStatus: current.status };
      } catch {
        // If we can't fetch current status, proceed without it
      }
    }
    return this.orderService.update(id, updateOrderDto);
  }

  @Patch(":id/cancel")
  @AuditLog({ entity: "Order", action: "cancel_order" })
  @ApiOperation({
    summary: "Cancel order",
    description: "Cancel an order with a reason",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: 12345,
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Cancellation reason" },
      },
      required: ["reason"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Order cancelled successfully",
    type: OrderDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid cancellation request",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async cancel(
    @Param("id", ParseIntPipe) id: number,
    @Body("reason") reason: string,
  ): Promise<OrderDto> {
    return this.orderService.cancel(id, reason);
  }

  @Delete(":id")
  @AuditLog({ entity: "Order", action: "delete_order" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete order",
    description: "Soft delete an order (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 204,
    description: "Order deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.orderService.remove(id);
  }
}
