import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested, ArrayMinSize, ArrayMaxSize } from "class-validator";
import { Type } from "class-transformer";
import { CreateCellOverrideDto } from "./create-cell-override.dto";

export class BulkUpsertCellOverrideDto {
  @ApiProperty({
    description: "Array of cell overrides to upsert (1–500 items)",
    type: [CreateCellOverrideDto],
    minItems: 1,
    maxItems: 500,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => CreateCellOverrideDto)
  overrides: CreateCellOverrideDto[] | undefined;
}
