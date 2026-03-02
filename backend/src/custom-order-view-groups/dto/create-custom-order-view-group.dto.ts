import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, Length } from "class-validator";

export class CreateCustomOrderViewGroupDto {
  @ApiProperty({
    description: "Group name",
    example: "Job Sheets",
    maxLength: 255,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  name: string | undefined;
}
