import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsNumber,
  IsOptional,
  IsEmail,
  IsBoolean,
  MaxLength,
  Min,
} from "class-validator";
import { Transform } from "class-transformer";

/**
 * Update Factory Data Transfer Object
 *
 * Defines the data that can be updated for an existing factory.
 * Matches PostgreSQL schema fields.
 */
export class UpdateFactoryDto {
  @ApiPropertyOptional({
    description: "User ID associated with this factory",
    example: 42,
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  userId?: number;

  @ApiPropertyOptional({
    description: "Factory full name. Maps to credentials.full_name.",
    example: "Aiken USA",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description:
      "Whether the factory's login account is enabled (false = blocked). Maps to credentials.blocked.",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: "Street address",
    example: "123 Leather Street",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  address?: string;

  @ApiPropertyOptional({
    description: "Postal/ZIP code",
    example: "SW1A 1AA",
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  zipcode?: string;

  @ApiPropertyOptional({
    description: "State/Province",
    example: "England",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: "City",
    example: "London",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: "Country",
    example: "United Kingdom",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({
    description: "Phone number",
    example: "+44 20 7946 0958",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phoneNo?: string;

  @ApiPropertyOptional({
    description: "Cell/Mobile phone number",
    example: "+44 7700 900000",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cellNo?: string;

  @ApiPropertyOptional({
    description: "Currency ID",
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseInt(value))
  currency?: number;

  @ApiPropertyOptional({
    description: "Email address",
    example: "factory@example.com",
    maxLength: 255,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailaddress?: string;
}
