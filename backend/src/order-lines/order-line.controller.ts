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
  ApiCookieAuth,
  ApiParam,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { OrderLineService } from "./order-line.service";
import { CreateOrderLineDto } from "./dto/create-order-line.dto";
import { UpdateOrderLineDto } from "./dto/update-order-line.dto";
import { QueryOrderLineDto } from "./dto/query-order-line.dto";
import { OrderLineDto } from "./dto/order-line.dto";

/**
 * OrderLine REST API Controller
 *
 * Handles HTTP requests for order line item management operations.
 * Provides CRUD operations and order-specific line item queries.
 */
@ApiTags("Order Lines")
@Controller({
  path: "order-lines",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class OrderLineController {
  constructor(private readonly orderLineService: OrderLineService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new order line",
    description:
      "Creates a new line item for an order with product and pricing details",
  })
  @ApiResponse({
    status: 201,
    description: "Order line created successfully",
    type: OrderLineDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(@Body() createDto: CreateOrderLineDto): Promise<OrderLineDto> {
    return this.orderLineService.create(createDto);
  }

  @Post("bulk")
  @ApiOperation({
    summary: "Bulk create order lines",
    description: "Create multiple order lines in a single operation",
  })
  @ApiResponse({
    status: 201,
    description: "Order lines created successfully",
    type: [OrderLineDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async bulkCreate(
    @Body() createDtos: CreateOrderLineDto[],
  ): Promise<OrderLineDto[]> {
    return this.orderLineService.bulkCreate(createDtos);
  }

  @Get()
  @ApiOperation({
    summary: "Get all order lines",
    description:
      "Retrieve all order lines with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Order lines retrieved successfully",
    schema: {
      type: "object",
      properties: {
        data: {
          type: "array",
          items: { $ref: "#/components/schemas/OrderLineDto" },
        },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
      },
    },
  })
  async findAll(@Query() query: QueryOrderLineDto): Promise<{
    data: OrderLineDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.orderLineService.findAll(query);
  }

  @Get("order/:orderId")
  @ApiOperation({
    summary: "Get order lines by order ID",
    description: "Retrieve all line items for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: "Order lines retrieved successfully",
    type: [OrderLineDto],
  })
  async findByOrderId(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<OrderLineDto[]> {
    return this.orderLineService.findByOrderId(orderId);
  }

  @Get("order/:orderId/total")
  @ApiOperation({
    summary: "Calculate order total",
    description: "Calculate the total amount for all line items in an order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: "Order total calculated successfully",
    schema: {
      type: "object",
      properties: {
        total: { type: "number" },
      },
    },
  })
  async calculateOrderTotal(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<{ total: number }> {
    const total = await this.orderLineService.calculateOrderTotal(orderId);
    return { total };
  }

  @Post("order/:orderId/resequence")
  @ApiOperation({
    summary: "Resequence order lines",
    description: "Update the sequence order of line items within an order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 123,
  })
  @ApiResponse({
    status: 200,
    description: "Order lines resequenced successfully",
    type: [OrderLineDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid line IDs provided",
  })
  async resequence(
    @Param("orderId", ParseIntPipe) orderId: number,
    @Body("lineIds") lineIds: number[],
  ): Promise<OrderLineDto[]> {
    return this.orderLineService.resequence(orderId, lineIds);
  }

  @Get("product/:productId")
  @ApiOperation({
    summary: "Get order lines by product ID",
    description: "Retrieve all line items containing a specific product",
  })
  @ApiParam({
    name: "productId",
    description: "Product ID",
    example: 456,
  })
  @ApiResponse({
    status: 200,
    description: "Order lines retrieved successfully",
    type: [OrderLineDto],
  })
  async findByProductId(
    @Param("productId", ParseIntPipe) productId: number,
  ): Promise<OrderLineDto[]> {
    return this.orderLineService.findByProductId(productId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get order line by ID",
    description: "Retrieve a specific order line by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Order line ID",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "Order line found",
    type: OrderLineDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order line not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<OrderLineDto> {
    return this.orderLineService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update order line",
    description:
      "Update order line information including quantity, pricing, and notes",
  })
  @ApiParam({
    name: "id",
    description: "Order line ID",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "Order line updated successfully",
    type: OrderLineDto,
  })
  @ApiResponse({
    status: 404,
    description: "Order line not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateOrderLineDto,
  ): Promise<OrderLineDto> {
    return this.orderLineService.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete order line",
    description: "Soft delete an order line (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Order line ID",
    example: 1,
  })
  @ApiResponse({
    status: 204,
    description: "Order line deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Order line not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.orderLineService.remove(id);
  }
}
