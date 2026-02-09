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
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { DatabaseQueryLogService } from "./database-query-log.service";
import { CreateDatabaseQueryLogDto } from "./dto/create-database-query-log.dto";
import { DatabaseQueryLogDto } from "./dto/database-query-log.dto";
import { QueryDatabaseQueryLogDto } from "./dto/query-database-query-log.dto";
import { PaginatedResponseDto } from "../common/dto/base-query.dto";

/**
 * Database Query Log REST API Controller
 *
 * Provides database query logging and performance analysis for developers and administrators.
 * Handles 74K+ query records with performance optimization insights.
 *
 * Security: Admin/Developer access only - all endpoints require JWT authentication
 * and appropriate privileges for debugging and performance analysis.
 */
@ApiTags("Database Query Logging")
@Controller({
  path: "database-query-logs",
  version: "1",
})
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class DatabaseQueryLogController {
  constructor(
    private readonly databaseQueryLogService: DatabaseQueryLogService,
  ) {}

  @Post()
  @ApiOperation({
    summary: "Create database query log entry",
    description:
      "Create a new database query log entry. Used for migration and system query logging.",
  })
  @ApiResponse({
    status: 201,
    description: "Database query log entry created successfully",
    type: DatabaseQueryLogDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data or duplicate legacy ID",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - admin/developer access required",
  })
  @ApiBody({ type: CreateDatabaseQueryLogDto })
  async create(
    @Body() createQueryLogDto: CreateDatabaseQueryLogDto,
  ): Promise<DatabaseQueryLogDto> {
    return this.databaseQueryLogService.create(createQueryLogDto);
  }

  @Get()
  @ApiOperation({
    summary: "Search database query logs",
    description:
      "Search and filter database query logs with high-performance pagination. " +
      "Optimized for handling 74K+ records with debugging and performance analysis capabilities.",
  })
  @ApiResponse({
    status: 200,
    description: "Database query logs retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/DatabaseQueryLogDto" },
            },
          },
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - admin/developer access required",
  })
  @ApiQuery({
    name: "query",
    type: QueryDatabaseQueryLogDto,
    required: false,
    description: "Query parameters for filtering, sorting, and pagination",
  })
  async findAll(
    @Query() query: QueryDatabaseQueryLogDto,
  ): Promise<PaginatedResponseDto<DatabaseQueryLogDto>> {
    return this.databaseQueryLogService.findAll(query);
  }

  @Get("statistics")
  @ApiOperation({
    summary: "Get database query statistics",
    description:
      "Retrieve comprehensive database query statistics for performance analysis and optimization",
  })
  @ApiResponse({
    status: 200,
    description: "Database query statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        totalQueries: { type: "number", example: 74939 },
        uniquePages: { type: "number", example: 85 },
        uniqueUsers: { type: "number", example: 125 },
        topPages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              page: { type: "string", example: "/api/orders/search" },
              count: { type: "number", example: 12500 },
            },
          },
        },
        topQueries: {
          type: "array",
          items: {
            type: "object",
            properties: {
              query: {
                type: "string",
                example: "SELECT * FROM orders WHERE customer_id = ?",
              },
              count: { type: "number", example: 8500 },
            },
          },
        },
        sqlOperations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              operation: { type: "string", example: "SELECT" },
              count: { type: "number", example: 65000 },
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
    totalQueries: number;
    uniquePages: number;
    uniqueUsers: number;
    topPages: Array<{ page: string; count: number }>;
    topQueries: Array<{ query: string; count: number }>;
    sqlOperations: Array<{ operation: string; count: number }>;
  }> {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    return this.databaseQueryLogService.getQueryStatistics(from, to);
  }

  @Get("analysis")
  @ApiOperation({
    summary: "Analyze query performance patterns",
    description:
      "Advanced analysis of query patterns with optimization recommendations. " +
      "Provides actionable insights for performance improvement.",
  })
  @ApiResponse({
    status: 200,
    description: "Query analysis completed successfully",
    schema: {
      type: "object",
      properties: {
        statistics: { type: "object", description: "Basic query statistics" },
        recommendations: {
          type: "array",
          items: { type: "string" },
          example: [
            "Avoid SELECT * queries",
            "Consider adding indexes for JOIN operations",
          ],
        },
        performanceInsights: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", example: "Query Optimization" },
              finding: {
                type: "string",
                example: "Found 150 queries using SELECT *",
              },
              impact: {
                type: "string",
                enum: ["high", "medium", "low"],
                example: "medium",
              },
              recommendation: {
                type: "string",
                example: "Replace SELECT * with specific column names",
              },
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
    description: "Start date for analysis (ISO 8601)",
    example: "2024-01-01T00:00:00.000Z",
  })
  @ApiQuery({
    name: "toDate",
    type: "string",
    required: false,
    description: "End date for analysis (ISO 8601)",
    example: "2024-12-31T23:59:59.999Z",
  })
  async analyzeQueryPatterns(
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
  ): Promise<{
    statistics: any;
    recommendations: string[];
    performanceInsights: Array<{
      category: string;
      finding: string;
      impact: "high" | "medium" | "low";
      recommendation: string;
    }>;
  }> {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;
    return this.databaseQueryLogService.analyzeQueryPatterns(from, to);
  }

  @Get("slow-queries")
  @ApiOperation({
    summary: "Get potentially slow queries",
    description:
      "Retrieve queries that match patterns associated with poor performance. " +
      "Essential for database optimization and performance tuning.",
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
    description: "Potentially slow queries retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/DatabaseQueryLogDto" },
            },
          },
        },
      ],
    },
  })
  async getPotentiallySlowQueries(
    @Query("page") page = 1,
    @Query("limit") limit = 50,
  ): Promise<PaginatedResponseDto<DatabaseQueryLogDto>> {
    return this.databaseQueryLogService.getPotentiallySlowQueries(
      Number(page),
      Number(limit),
    );
  }

  @Get("users/:userId/queries")
  @ApiOperation({
    summary: "Get user query logs",
    description:
      "Retrieve database query logs for a specific user. " +
      "Useful for debugging user-specific performance issues.",
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
    description: "User query logs retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/DatabaseQueryLogDto" },
            },
          },
        },
      ],
    },
  })
  async getUserQueryLogs(
    @Param("userId", ParseIntPipe) userId: number,
    @Query("page") page = 1,
    @Query("limit") limit = 100,
  ): Promise<PaginatedResponseDto<DatabaseQueryLogDto>> {
    return this.databaseQueryLogService.getUserQueryLogs(
      userId,
      Number(page),
      Number(limit),
    );
  }

  @Get("pages/:page/queries")
  @ApiOperation({
    summary: "Get page query logs",
    description:
      "Retrieve database query logs for a specific page/endpoint. " +
      "Essential for page-specific performance analysis.",
  })
  @ApiParam({
    name: "page",
    description: "Page/endpoint path",
    example: "/api/orders",
  })
  @ApiQuery({
    name: "pageNum",
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
    description: "Page query logs retrieved successfully",
    schema: {
      allOf: [
        { $ref: "#/components/schemas/PaginatedResponseDto" },
        {
          properties: {
            data: {
              type: "array",
              items: { $ref: "#/components/schemas/DatabaseQueryLogDto" },
            },
          },
        },
      ],
    },
  })
  async getPageQueryLogs(
    @Param("page") page: string,
    @Query("pageNum") pageNum = 1,
    @Query("limit") limit = 100,
  ): Promise<PaginatedResponseDto<DatabaseQueryLogDto>> {
    return this.databaseQueryLogService.getPageQueryLogs(
      page,
      Number(pageNum),
      Number(limit),
    );
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get database query log by ID",
    description:
      "Retrieve a specific database query log entry by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Database query log ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Database query log entry found",
    type: DatabaseQueryLogDto,
  })
  @ApiResponse({
    status: 404,
    description: "Database query log entry not found",
  })
  async findOne(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<DatabaseQueryLogDto> {
    return this.databaseQueryLogService.findOne(id);
  }

  @Post("bulk")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Bulk create database query logs",
    description:
      "Create multiple database query log entries at once. " +
      "Optimized for migration of 74K+ legacy records.",
  })
  @ApiResponse({
    status: 201,
    description: "Database query logs created successfully",
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
    type: [CreateDatabaseQueryLogDto],
    description: "Array of database query log entries to create",
  })
  async bulkCreate(
    @Body() createQueryLogDtos: CreateDatabaseQueryLogDto[],
  ): Promise<{ created: number; skipped: number }> {
    return this.databaseQueryLogService.bulkCreate(createQueryLogDtos);
  }

  @Post("log-query")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Log database query",
    description:
      "Log a database query in real-time. " +
      "Convenience endpoint for application-level query logging.",
  })
  @ApiResponse({
    status: 201,
    description: "Query logged successfully",
    type: DatabaseQueryLogDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  @ApiBody({
    schema: {
      type: "object",
      required: ["query", "userId", "page", "backtrace"],
      properties: {
        query: {
          type: "string",
          example: "SELECT * FROM orders WHERE customer_id = ? AND status = ?",
          maxLength: 10000,
        },
        userId: {
          type: "number",
          example: 54321,
        },
        page: { type: "string", example: "/api/orders/search" },
        backtrace: {
          type: "string",
          example:
            "at OrderService.findAll (/app/src/orders/order.service.ts:45:12)",
        },
        legacyUserId: { type: "number", example: 789 },
      },
    },
  })
  async logQuery(
    @Body()
    body: {
      query: string;
      userId: number;
      page: string;
      backtrace: string;
      legacyUserId?: number;
    },
  ): Promise<DatabaseQueryLogDto> {
    return this.databaseQueryLogService.logQuery(
      body.query,
      body.userId,
      body.page,
      body.backtrace,
    );
  }
}
