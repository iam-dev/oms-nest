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
  BadRequestException,
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
import { AuthGuard } from "@nestjs/passport";
import { RolesGuard } from "../roles/roles.guard";
import { Roles } from "../roles/roles.decorator";
import { RoleEnum } from "../roles/roles.enum";
import { BrandService } from "./brand.service";
import { CreateBrandDto } from "./dto/create-brand.dto";
import { UpdateBrandDto } from "./dto/update-brand.dto";
import { BrandDto } from "./dto/brand.dto";

@ApiTags("Brands")
@ApiBearerAuth()
@Roles(RoleEnum.admin, RoleEnum.supervisor)
@UseGuards(AuthGuard("jwt"), RolesGuard)
@Controller({
  path: "brands",
  version: "1",
})
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new brand",
    description: "Creates a new saddle brand in the system",
  })
  @ApiResponse({
    status: 201,
    description: "Brand created successfully",
    type: BrandDto,
  })
  @ApiResponse({
    status: 400,
    description: "Validation error",
  })
  @ApiResponse({
    status: 409,
    description: "Brand with this name already exists",
  })
  async create(@Body() createBrandDto: CreateBrandDto): Promise<BrandDto> {
    return this.brandService.create(createBrandDto);
  }

  @Get()
  @ApiOperation({
    summary: "Get all brands",
    description: "Retrieve all brands with pagination and filtering",
  })
  @ApiResponse({
    status: 200,
    description: "Brands retrieved successfully",
    type: [BrandDto],
  })
  @ApiQuery({
    name: "page",
    required: false,
    type: Number,
    description: "Page number (default: 1)",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "Items per page (default: 10)",
  })
  @ApiQuery({
    name: "search",
    required: false,
    type: String,
    description: "Search by brand name",
  })
  async findAll(
    @Query("page") page: string = "1",
    @Query("limit") limit: string = "10",
    @Query("search") search?: string,
  ) {
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      throw new BadRequestException("Page must be a positive number");
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      throw new BadRequestException("Limit must be between 1 and 100");
    }

    return this.brandService.findAll(pageNum, limitNum, search);
  }

  @Get("active")
  @ApiOperation({
    summary: "Get active brands",
    description: "Retrieve all active brands",
  })
  @ApiResponse({
    status: 200,
    description: "Active brands retrieved successfully",
    type: [BrandDto],
  })
  async findActiveBrands(): Promise<BrandDto[]> {
    return this.brandService.findActiveBrands();
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get brand by ID",
    description: "Retrieve a specific brand by its ID",
  })
  @ApiParam({
    name: "id",
    type: "number",
    description: "Brand ID",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "Brand retrieved successfully",
    type: BrandDto,
  })
  @ApiResponse({
    status: 404,
    description: "Brand not found",
  })
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<BrandDto> {
    return this.brandService.findOne(id);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update brand",
    description: "Update a brand's information",
  })
  @ApiParam({
    name: "id",
    type: "number",
    description: "Brand ID",
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: "Brand updated successfully",
    type: BrandDto,
  })
  @ApiResponse({
    status: 404,
    description: "Brand not found",
  })
  @ApiResponse({
    status: 409,
    description: "Brand with this name already exists",
  })
  async update(
    @Param("id", ParseIntPipe) id: number,
    @Body() updateBrandDto: UpdateBrandDto,
  ): Promise<BrandDto> {
    return this.brandService.update(id, updateBrandDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete brand",
    description: "Soft delete a brand (marks as deleted)",
  })
  @ApiParam({
    name: "id",
    type: "number",
    description: "Brand ID",
    example: 1,
  })
  @ApiResponse({
    status: 204,
    description: "Brand deleted successfully",
  })
  @ApiResponse({
    status: 404,
    description: "Brand not found",
  })
  async remove(@Param("id", ParseIntPipe) id: number): Promise<void> {
    return this.brandService.remove(id);
  }
}
