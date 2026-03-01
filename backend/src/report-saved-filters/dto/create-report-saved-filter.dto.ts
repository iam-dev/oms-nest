import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  IsObject,
  Length,
} from "class-validator";

export class CreateReportSavedFilterDto {
  @ApiProperty({
    description: "Filter preset name",
    example: "Q1 European Fitters",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string | undefined;

  @ApiProperty({
    description: "Filter configuration JSON",
    example: { fitters: ["John"], statuses: ["In Production"] },
  })
  @IsObject()
  @IsNotEmpty()
  filters: Record<string, unknown> | undefined;

  @ApiPropertyOptional({ description: "Set as default filter", default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
