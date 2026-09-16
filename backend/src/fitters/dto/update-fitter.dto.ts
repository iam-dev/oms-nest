import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { CreateFitterDto } from "./create-fitter.dto";

export class UpdateFitterDto extends PartialType(CreateFitterDto) {
  @ApiPropertyOptional({
    description:
      "Whether the fitter's login account is enabled (false = blocked). Maps to credentials.blocked.",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
