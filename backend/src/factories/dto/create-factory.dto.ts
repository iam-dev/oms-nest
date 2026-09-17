import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEmail,
  Length,
} from "class-validator";

/**
 * Create Factory Data Transfer Object
 *
 * Defines the required data for creating a new factory.
 * A factory always needs a login account (`factories.user_id` is NOT NULL):
 * either pass an existing `userId`, or a `username` and the service will
 * create a factory-type credentials row and email a set-password link.
 */
export class CreateFactoryDto {
  @ApiPropertyOptional({
    description:
      "Existing user ID to link. Omit to create a new login account from `username`.",
    example: 123,
  })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({
    description: "Username for the new factory login account",
    example: "aikenusa",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  username?: string;

  @ApiPropertyOptional({
    description: "Factory full name (stored as credentials.full_name)",
    example: "Aiken USA",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  name?: string;

  @ApiPropertyOptional({
    description: "Factory address",
    example: "123 Industrial Park",
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string;

  @ApiPropertyOptional({
    description: "Factory postal/zip code",
    example: "10001",
  })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  zipcode?: string;

  @ApiPropertyOptional({
    description: "Factory state/province",
    example: "NY",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  state?: string;

  @ApiPropertyOptional({
    description: "Factory city",
    example: "New York",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional({
    description: "Factory country",
    example: "United States",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional({
    description: "Factory phone number",
    example: "+1-555-123-4567",
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phoneNo?: string;

  @ApiPropertyOptional({
    description: "Factory cell/mobile number",
    example: "+1-555-987-6543",
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  cellNo?: string;

  @ApiPropertyOptional({
    description: "Currency code (integer identifier)",
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  currency?: number;

  @ApiPropertyOptional({
    description: "Factory email address",
    example: "factory@example.com",
  })
  @IsOptional()
  @IsEmail()
  @Length(0, 255)
  emailaddress?: string;
}
