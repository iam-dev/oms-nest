import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from "class-validator";
import { FileDto } from "../../files/dto/file.dto";
import { Transform } from "class-transformer";
import { lowerCaseTransformer } from "../../utils/transformers/lower-case.transformer";

export class AuthUpdateDto {
  @ApiPropertyOptional({ type: () => FileDto })
  @IsOptional()
  photo?: FileDto | null;

  @ApiPropertyOptional({ example: "John" })
  @IsOptional()
  @IsNotEmpty({ message: "mustBeNotEmpty" })
  firstName?: string;

  // May be empty: legacy accounts often carry a single-word full_name, and a
  // user must be able to save their profile (or clear a surname) in that case.
  @ApiPropertyOptional({ example: "Doe" })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: "new.email@example.com" })
  @IsOptional()
  @IsNotEmpty()
  @IsEmail()
  @Transform(lowerCaseTransformer)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNotEmpty({ message: "mustBeNotEmpty" })
  oldPassword?: string;
}
