import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  Length,
  IsNumber,
} from "class-validator";
import { Type } from "class-transformer";

export class ColumnConfigDto {
  @ApiProperty({ description: "Column key identifier", example: "orderNumber" })
  @IsString()
  @IsNotEmpty()
  key: string | undefined;

  @ApiProperty({ description: "Column display label", example: "Order #" })
  @IsString()
  @IsNotEmpty()
  label: string | undefined;

  @ApiProperty({ description: "Whether column is visible", example: true })
  @IsBoolean()
  visible: boolean | undefined;

  @ApiProperty({ description: "Column display order", example: 0 })
  @IsNumber()
  order: number | undefined;
}

export class CreateCustomOrderViewDto {
  @ApiProperty({
    description: "View name",
    example: "My Export View",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string | undefined;

  @ApiProperty({
    description: "Column configuration",
    type: [ColumnConfigDto],
    example: [
      { key: "orderNumber", label: "Order #", visible: true, order: 0 },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnConfigDto)
  columns: ColumnConfigDto[] | undefined;

  @ApiPropertyOptional({ description: "Set as default view", default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: "Group ID this view belongs to" })
  @IsOptional()
  @IsNumber()
  groupId?: number;

  @ApiPropertyOptional({
    description: "Tab order within group",
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  tabOrder?: number;
}
