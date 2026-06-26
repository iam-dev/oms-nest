import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber, MaxLength } from "class-validator";

export class CreateCellOverrideDto {
  @ApiProperty({ description: "Order ID", example: 1234 })
  @IsNumber()
  @IsNotEmpty()
  orderId: number | undefined;

  @ApiProperty({ description: "Column key", example: "customerName" })
  @IsString()
  @IsNotEmpty()
  columnKey: string | undefined;

  @ApiProperty({
    description: "Override value (max 2000 characters)",
    example: "Custom Customer Name",
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  overrideValue: string | undefined;
}
