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
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";
import { QueryCommentDto } from "./dto/query-comment.dto";
import { CommentDto } from "./dto/comment.dto";
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";

/**
 * Comment REST API Controller
 *
 * Handles HTTP requests for comment management operations.
 * Provides endpoints for creating, reading, updating, and deleting comments
 * associated with orders.
 */
@ApiTags("Comments")
@Controller({
  path: "comments",
  version: "1",
})
@ApiCookieAuth("token")
@Roles(RoleEnum.admin, RoleEnum.supervisor, RoleEnum.fitter)
@UseGuards(AuthGuard("jwt"), RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({
    summary: "Create a new comment",
    description:
      "Creates a new comment for an order. Can be internal or customer-facing.",
  })
  @ApiResponse({
    status: 201,
    description: "Comment created successfully",
    type: CommentDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input data",
  })
  async create(
    @Body() createCommentDto: CreateCommentDto,
  ): Promise<CommentDto> {
    return this.commentsService.create(createCommentDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all comments",
    description: "Retrieve all comments with optional filtering and pagination",
  })
  @ApiResponse({
    status: 200,
    description: "Comments retrieved successfully",
    type: [CommentDto],
  })
  async findAll(@Query() query: QueryCommentDto): Promise<CommentDto[]> {
    return this.commentsService.findAll(query);
  }

  @Get("order/:orderId")
  @ApiOperation({
    summary: "Get comments by order ID",
    description: "Retrieve all comments for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Order comments retrieved successfully",
    type: [CommentDto],
  })
  async findByOrderId(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<CommentDto[]> {
    return this.commentsService.findByOrderId(orderId);
  }

  @Get("order/:orderId/public")
  @ApiOperation({
    summary: "Get public comments by order ID",
    description: "Retrieve all non-internal comments for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Public order comments retrieved successfully",
    type: [CommentDto],
  })
  async findPublicByOrderId(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<CommentDto[]> {
    return this.commentsService.findPublicByOrderId(orderId);
  }

  @Get("order/:orderId/internal")
  @ApiOperation({
    summary: "Get internal comments by order ID",
    description: "Retrieve all internal comments for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Internal order comments retrieved successfully",
    type: [CommentDto],
  })
  async findInternalByOrderId(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<CommentDto[]> {
    return this.commentsService.findInternalByOrderId(orderId);
  }

  @Get("order/:orderId/stats")
  @ApiOperation({
    summary: "Get comment statistics for an order",
    description:
      "Get comment counts and breakdown by type for a specific order",
  })
  @ApiParam({
    name: "orderId",
    description: "Order ID",
    example: 12345,
  })
  @ApiResponse({
    status: 200,
    description: "Comment statistics retrieved successfully",
    schema: {
      type: "object",
      properties: {
        total: { type: "number" },
        internal: { type: "number" },
        public: { type: "number" },
        byType: {
          type: "object",
          additionalProperties: { type: "number" },
        },
      },
    },
  })
  async getCommentStats(
    @Param("orderId", ParseIntPipe) orderId: number,
  ): Promise<{
    total: number;
    internal: number;
    public: number;
    byType: Record<string, number>;
  }> {
    return this.commentsService.getCommentStats(orderId);
  }

  @Get("user/:userId")
  @ApiOperation({
    summary: "Get comments by user ID",
    description: "Retrieve all comments created by a specific user",
  })
  @ApiParam({
    name: "userId",
    description: "User ID",
    example: 42,
  })
  @ApiResponse({
    status: 200,
    description: "User comments retrieved successfully",
    type: [CommentDto],
  })
  async findByUserId(
    @Param("userId", ParseIntPipe) userId: number,
  ): Promise<CommentDto[]> {
    return this.commentsService.findByUserId(userId);
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get comment by ID",
    description: "Retrieve a specific comment by its unique identifier",
  })
  @ApiParam({
    name: "id",
    description: "Comment ID",
    example: 1001,
  })
  @ApiResponse({
    status: 200,
    description: "Comment found",
    type: CommentDto,
  })
  @ApiResponse({
    status: 404,
    description: "Comment not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<CommentDto> {
    return this.commentsService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update comment",
    description: "Update comment content, type, or internal visibility",
  })
  @ApiParam({
    name: "id",
    description: "Comment ID",
    example: 1001,
  })
  @ApiResponse({
    status: 200,
    description: "Comment updated successfully",
    type: CommentDto,
  })
  @ApiResponse({
    status: 404,
    description: "Comment not found",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid update data",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateCommentDto: UpdateCommentDto,
  ): Promise<CommentDto> {
    return this.commentsService.update(id, updateCommentDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete comment",
    description: "Soft delete a comment (sets deletedAt timestamp)",
  })
  @ApiParam({
    name: "id",
    description: "Comment ID",
    example: 1001,
  })
  @ApiResponse({
    status: 204,
    description: "Comment deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Comment not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.commentsService.remove(id);
  }
}
