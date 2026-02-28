import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Factory Data Transfer Object
 *
 * Represents a factory entity in API responses
 */
export class FactoryDto {
  @ApiProperty({
    description: "Unique identifier for the factory",
    example: 12345,
  })
  id: number;

  @ApiPropertyOptional({
    description: "Associated user ID",
    example: 123,
  })
  userId?: number;

  @ApiPropertyOptional({
    description: "Soft delete flag (0 = active, 1 = deleted)",
    example: 0,
  })
  deleted?: number;

  @ApiPropertyOptional({
    description: "Factory address",
    example: "123 Industrial Park",
  })
  address?: string;

  @ApiPropertyOptional({
    description: "Factory postal/zip code",
    example: "10001",
  })
  zipcode?: string;

  @ApiPropertyOptional({
    description: "Factory state/province",
    example: "NY",
  })
  state?: string;

  @ApiPropertyOptional({
    description: "Factory city",
    example: "New York",
  })
  city?: string;

  @ApiPropertyOptional({
    description: "Factory country",
    example: "United States",
  })
  country?: string;

  @ApiPropertyOptional({
    description: "Factory phone number",
    example: "+1-555-123-4567",
  })
  phoneNo?: string;

  @ApiPropertyOptional({
    description: "Factory cell/mobile number",
    example: "+1-555-987-6543",
  })
  cellNo?: string;

  @ApiPropertyOptional({
    description: "Currency code (integer identifier)",
    example: 1,
  })
  currency?: number;

  @ApiPropertyOptional({
    description: "Factory email address",
    example: "factory@example.com",
  })
  emailaddress?: string;

  @ApiPropertyOptional({
    description: "Creation timestamp",
    example: "2023-01-01T00:00:00Z",
  })
  createdAt?: Date;

  @ApiPropertyOptional({
    description: "Last update timestamp",
    example: "2023-01-01T12:00:00Z",
  })
  updatedAt?: Date;

  @ApiPropertyOptional({
    description: "ID of user who created this factory",
  })
  createdBy?: number;

  @ApiPropertyOptional({
    description: "ID of user who last updated this factory",
  })
  updatedBy?: number;

  @ApiPropertyOptional({
    description: "Soft delete timestamp",
  })
  deletedAt?: Date;

  @ApiPropertyOptional({
    description: "Whether factory is active (deleted = 0)",
    example: true,
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: "Full address (computed)",
    example: "123 Industrial Park, New York, NY, 10001, United States",
  })
  fullAddress?: string;

  @ApiPropertyOptional({
    description: "Factory display name (computed from user name or city)",
    example: "Aiken USA",
  })
  displayName?: string;

  @ApiPropertyOptional({
    description: "Username of the factory owner",
    example: "aikenusa",
  })
  username?: string;

  @ApiPropertyOptional({
    description: "Company/user name from credentials table",
    example: "Aiken USA",
  })
  name?: string;

  @ApiPropertyOptional({
    description: "Whether the factory user account is enabled (not blocked)",
    example: true,
  })
  enabled?: boolean;

  @ApiPropertyOptional({
    description: "Last login timestamp of the factory user",
    example: "2024-01-15T10:30:00Z",
  })
  lastLogin?: Date | string;
}
