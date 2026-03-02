import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, IsNumber } from "class-validator";

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
    description: "Override value",
    example: "Custom Customer Name",
  })
  @IsString()
  @IsNotEmpty()
  overrideValue: string | undefined;
}
