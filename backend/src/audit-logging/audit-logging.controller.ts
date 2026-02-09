import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { AuditLoggingService } from "./audit-logging.service";
import { CreateAuditLogDto } from "./dto/create-audit-log.dto";
import { AuditLogDto } from "./dto/audit-log.dto";
import { QueryAuditLogDto } from "./dto/query-audit-log.dto";
import { PaginatedResponseDto } from "../common/dto/base-query.dto";

/**
 * Audit Logging REST API Controller
 *
 * Provides comprehensive audit trail access for administrators.
 * Handles 764K+ audit records with high-performance search capabilities.
 *
 * Security: Admin access only - all endpoints require JWT authentication
 * and admin privileges for compliance and security.
 */
@ApiTags("Audit Logging")
@Controller({
  path: "audit-logs",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class AuditLoggingController {
  constructor(private readonly auditLoggingService: AuditLoggingService) {}

  @Post()
  @ApiOperation({
    summary: "Create audit log entry",
    description:
      "Create a new audit log entry. Used for migration and system logging.",
  })
  @ApiResponse({
    status: 201,
    description: "Audit log entry created successfully",
    type: AuditLogDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data or duplicate legacy ID",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - admin access required",
  })
  @ApiBody({ type: CreateAuditLogDto })
  async create(
    @Body() createAuditLogDto: CreateAuditLogDto,
  ): Promise<AuditLogDto> {
    return this.auditLoggingService.create(createAuditLogDto);
  }

  @Get()
  @ApiOperation({
    summary: "Search audit logs",
    description:
      "Search and filter audit logs with high-performance pagination. " +
      "Optimized for handling 764K+ records with complex filtering capabilities.",
  })
  @ApiResponse({
    status: 200,
    description: "Audit logs retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogDto" },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - admin access required",
  })
  @ApiQuery({
    name: "query",
    type: QueryAuditLogDto,
    required: false,
    description: "Query parameters for filtering, sorting, and pagination",
  })
  async findAll(
    @Query() query: QueryAuditLogDto,
  ): Promise<PaginatedResponseDto<AuditLogDto>> {
    return this.auditLoggingService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({
    summary: "Get audit statistics",
    description:
      "Retrieve comprehensive audit statistics for dashboard and reporting",
  })
  @ApiResponse({
    status: 200,
    description: "Audit statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        totalLogs: { type: "number", example: 764381 },
        statusChanges: { type: "number", example: 125000 },
        uniqueUsers: { type: "number", example: 450 },
        uniqueOrders: { type: "number", example: 85000 },
        topActions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              action: { type: "string", example: "Order status changed" },
              count: { type: "number", example: 25000 },
            },
          },
        },
      },
    },
  })
  @ApiQuery({
    name: "fromDate",
    type: "string",
    required: false,
    description: "Start date for statistics (ISO 8601)",
    example: "2024-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "toDate",
    type: "string",
    required: false,
    description: "End date for statistics (ISO 8601)",
    example: "2024-12-31T23:59:59.999Z",
  })
  async getStatistics(
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
  ): Promise<{
    totalLogs: number;
    statusChanges: number;
    uniqueUsers: number;
    uniqueOrders: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    return this.auditLoggingService.getAuditStatistics(from, to);
  }

  @Get("orders/:orderId/trail")
  @ApiOperation({
    summary: "Get order audit trail",
    description:
      "Retrieve complete audit trail for a specific order. " +
      "Essential for compliance and order history tracking.",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 67890,
  })
  @ApiQuery({
    name: "page",
    type: "number",
    required: false,
    description: "Page number (1-based)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    type: "number",
    required: false,
    description: "Items per page",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Order audit trail retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogDto" },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: "Order not found",
  })
  async getOrderAuditTrail(
    @Param("orderId", ParseIntPipe) orderId: number,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
  ): Promise<PaginatedResponseDto<AuditLogDto>> {
    return this.auditLoggingService.getOrderAuditTrail(
      orderId,
      Number(page),
      Number(limit),
    );
  }

  @Get("users/:userId/trail")
  @ApiOperation({
    summary: "Get user audit trail",
    description:
      "Retrieve audit trail for a specific user. " +
      "Useful for user activity analysis and compliance tracking.",
  })
  @ApiParam({
    name: "userId",
    description: "User ID",
    example: 54321,
  })
  @ApiQuery({
    name: "page",
    type: "number",
    required: false,
    description: "Page number (1-based)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    type: "number",
    required: false,
    description: "Items per page",
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: "User audit trail retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogDto" },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: "User not found",
  })
  async getUserAuditTrail(
    @Param("userId", ParseIntPipe) userId: number,
    @Query("page") page = 1,
    @Query("limit") limit = 100,
  ): Promise<PaginatedResponseDto<AuditLogDto>> {
    return this.auditLoggingService.getUserAuditTrail(
      userId,
      Number(page),
      Number(limit),
    );
  }

  @Get("status-changes")
  @ApiOperation({
    summary: "Get status change history",
    description:
      "Retrieve history of order status changes. " +
      "Critical for tracking order progression and compliance.",
  })
  @ApiQuery({
    name: "orderId",
    type: "number",
    required: false,
    description: "Filter by specific order ID",
    example: 67890,
  })
  @ApiQuery({
    name: "fromStatus",
    type: "number",
    required: false,
    description: "Filter by previous status",
    example: 1,
  })
  @ApiQuery({
    name: "toStatus",
    type: "number",
    required: false,
    description: "Filter by new status",
    example: 2,
  })
  @ApiQuery({
    name: "page",
    type: "number",
    required: false,
    description: "Page number (1-based)",
    example: 1,
  })
  @ApiQuery({
    name: "limit",
    type: "number",
    required: false,
    description: "Items per page",
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: "Status change history retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/AuditLogDto" },
            },
          },
        },
      ],
    },
  })
  async getStatusChangeHistory(
    @Query("orderId") orderId?: number,
    @Query("fromStatus") fromStatus?: number,
    @Query("toStatus") toStatus?: number,
    @Query("page") page = 1,
    @Query("limit") limit = 50,
  ): Promise<PaginatedResponseDto<AuditLogDto>> {
    return this.auditLoggingService.getStatusChangeHistory(
      orderId ? Number(orderId) : undefined,
      fromStatus ? Number(fromStatus) : undefined,
      toStatus ? Number(toStatus) : undefined,
      Number(page),
      Number(limit),
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get audit log by ID",
    description: "Retrieve a specific audit log entry by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Audit log ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Audit log entry found",
    type: AuditLogDto,
  })
  @ApiResponse({
    status: 404,
    description: "Audit log entry not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<AuditLogDto> {
    return this.auditLoggingService.findOne(id);
  }

  @Post("bulk")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Bulk create audit logs",
    description:
      "Create multiple audit log entries at once. " +
      "Optimized for migration of 764K+ legacy records.",
  })
  @ApiResponse({
    status: 201,
    description: "Audit logs created successfully",
    schema: {
      type: "object",
      properties: {
        created: { type: "number", example: 1000 },
        skipped: { type: "number", example: 0 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiBody({
    type: [CreateAuditLogDto],
    description: "Array of audit log entries to create",
  })
  async bulkCreate(
    @Body() createAuditLogDtos: CreateAuditLogDto[],
  ): Promise<{ created: number; skipped: number }> {
    return this.auditLoggingService.bulkCreate(createAuditLogDtos);
  }

  @Post("log-action")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Log system action",
    description:
      "Log a new system action in real-time. " +
      "Convenience endpoint for application-level logging.",
  })
  @ApiResponse({
    status: 201,
    description: "Action logged successfully",
    type: AuditLogDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["userId", "action"],
      properties: {
        userId: {
          type: "number",
          example: 54321,
        },
        action: {
          type: "string",
          example: "Order status changed from pending to in_progress",
        },
        orderId: {
          type: "number",
          example: 67890,
        },
        orderStatusFrom: { type: "number", example: 1 },
        orderStatusTo: { type: "number", example: 2 },
        legacyUserId: { type: "number", example: 789 },
        userType: { type: "number", example: 2 },
      },
    },
  })
  async logAction(
    @Body()
    body: {
      userId: number;
      action: string;
      orderId?: number;
      orderStatusFrom?: number;
      orderStatusTo?: number;
      legacyUserId?: number;
      userType?: number;
    },
  ): Promise<AuditLogDto> {
    return this.auditLoggingService.logAction(
      body.userId,
      body.action,
      body.orderId,
      body.orderStatusFrom,
      body.orderStatusTo,
      body.userType,
    );
  }

  @Post("archive")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Archive old audit logs",
    description:
      "Archive audit logs older than specified date. " +
      "Part of retention management policy.",
  })
  @ApiResponse({
    status: 200,
    description: "Audit logs archived successfully",
    schema: {
      type: "object",
      properties: {
        archived: { type: "number", example: 50000 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "Invalid date format",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["beforeDate"],
      properties: {
        beforeDate: {
          type: "string",
          format: "date-time",
          example: "2023-01-01T00:00:00.000Z",
          description: "Archive logs older than this date",
        },
      },
    },
  })
  async archiveOldLogs(
    @Body() body: { beforeDate: string },
  ): Promise<{ archived: number }> {
    return this.auditLoggingService.archiveOldLogs(new Date(body.beforeDate));
  }
}
