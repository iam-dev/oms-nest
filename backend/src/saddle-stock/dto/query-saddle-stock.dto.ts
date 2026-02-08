import { IsIn, IsOptional, IsString } from "class-validator";
import { Type } from "class-transformer";

export class QuerySaddleStockDto {
  @IsOptional()
  @IsIn(["my", "available", "all"])
  type?: "my" | "available" | "all";

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
