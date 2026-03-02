import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { CreateCellOverrideDto } from "./create-cell-override.dto";

export class BulkUpsertCellOverrideDto {
  @ApiProperty({
    description: "Array of cell overrides to upsert",
    type: [CreateCellOverrideDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCellOverrideDto)
  overrides: CreateCellOverrideDto[] | undefined;
}
