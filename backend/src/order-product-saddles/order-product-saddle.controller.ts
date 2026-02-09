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
import { OrderProductSaddleService } from "./order-product-saddle.service";
import { CreateOrderProductSaddleDto } from "./dto/create-order-product-saddle.dto";
import { UpdateOrderProductSaddleDto } from "./dto/update-order-product-saddle.dto";
import { QueryOrderProductSaddleDto } from "./dto/query-order-product-saddle.dto";
import { OrderProductSaddleDto } from "./dto/order-product-saddle.dto";

/**
 * OrderProductSaddle REST API Controller
 *
 * Handles HTTP requests for managing order-product-saddle relationships.
 * Provides endpoints for linking products (saddles) to orders with configuration details.
 */
@ApiTags("Order Product Saddles")
@Controller({
  path: "order_product_saddles",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class OrderProductSaddleController {
  constructor(
    private readonly orderProductSaddleService: OrderProductSaddleService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create a new order-product-saddle relationship",
    description:
      "Links a product (saddle) to an order with configuration and quantity",
  })
  @ApiResponse({
    status: 201,
    description: "Order-product relationship created successfully",
    type: OrderProductSaddleDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(
    @Body() createDto: CreateOrderProductSaddleDto,
  ): Promise<OrderProductSaddleDto> {
    return this.orderProductSaddleService.create(createDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all order-product-saddle relationships",
    description:
      "Retrieve all relationships with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Relationships retrieved successfully",
    type: [OrderProductSaddleDto],
  })
  async findAll(
    @Query() query: QueryOrderProductSaddleDto,
  ): Promise<OrderProductSaddleDto[]> {
    return this.orderProductSaddleService.findAll(query);
  }

  @Get("order/:orderId")
  @ApiOperation({
    summary: "Get all products for a specific order",
    description:
      "Retrieve all product-saddle relationships for a given order ID",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 1001,
    type: "integer",
  })
  @ApiResponse({
    status: 200,
    description: "Order products retrieved successfully",
    type: [OrderProductSaddleDto],
  })
  async findByOrderId(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<OrderProductSaddleDto[]> {
    return this.orderProductSaddleService.findByOrderId(orderId);
  }

  @Get("order/:orderId/count")
  @ApiOperation({
    summary: "Count products for an order",
    description: "Get the total number of products associated with an order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 1001,
    type: "integer",
  })
  @ApiResponse({
    status: 200,
    description: "Count retrieved successfully",
    schema: {
      type: "object",
      properties: {
        count: { type: "number" },
        totalQuantity: { type: "number" },
      },
    },
  })
  async getOrderProductCount(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<{ count: number; totalQuantity: number }> {
    const [count, totalQuantity] = await Promise.all([
      this.orderProductSaddleService.countByOrderId(orderId),
      this.orderProductSaddleService.getTotalQuantityByOrderId(orderId),
    ]);

    return { count, totalQuantity };
  }

  @Get("product/:productId")
  @ApiOperation({
    summary: "Get all orders for a specific product",
    description: "Retrieve all order relationships for a given product ID",
  })
  @ApiParam({
    name: "productId",
    description: "Product (Saddle) ID",
    example: 500,
    type: "integer",
  })
  @ApiResponse({
    status: 200,
    description: "Product orders retrieved successfully",
    type: [OrderProductSaddleDto],
  })
  async findByProductId(
    @Param("productId", ParseIntPipe) productId: number,
  ): Promise<OrderProductSaddleDto[]> {
    return this.orderProductSaddleService.findByProductId(productId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get order-product-saddle relationship by ID",
    description: "Retrieve a specific relationship by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Relationship ID",
    example: 12345,
    type: "integer",
  })
  @ApiResponse({
    status: 200,
    description: "Relationship found",
    type: OrderProductSaddleDto,
  })
  @ApiResponse({
    status: 404,
    description: "Relationship not found",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<OrderProductSaddleDto> {
    return this.orderProductSaddleService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update order-product-saddle relationship",
    description: "Update configuration, quantity, notes, or other details",
  })
  @ApiParam({
    name: "id",
    description: "Relationship ID",
    example: 12345,
    type: "integer",
  })
  @ApiResponse({
    status: 200,
    description: "Relationship updated successfully",
    type: OrderProductSaddleDto,
  })
  @ApiResponse({
    status: 404,
    description: "Relationship not found",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateDto: UpdateOrderProductSaddleDto,
  ): Promise<OrderProductSaddleDto> {
    return this.orderProductSaddleService.update(id, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete order-product-saddle relationship",
    description: "Soft delete a relationship (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Relationship ID",
    example: 12345,
    type: "integer",
  })
  @ApiResponse({
    status: 204,
    description: "Relationship deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Relationship not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.orderProductSaddleService.remove(id);
  }

  @Post("bulk")
  @ApiOperation({
    summary: "Bulk create order-product-saddle relationships",
    description: "Create multiple relationships in a single request",
  })
  @ApiResponse({
    status: 201,
    description: "Relationships created successfully",
    type: [OrderProductSaddleDto],
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async bulkCreate(
    @Body() createDtos: CreateOrderProductSaddleDto[],
  ): Promise<OrderProductSaddleDto[]> {
    return this.orderProductSaddleService.bulkCreate(createDtos);
  }
}
