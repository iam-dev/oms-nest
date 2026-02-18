import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEmail,
  Length,
} from "class-validator";

export class CreateFitterDto {
  @ApiPropertyOptional({
    description: "Username for the fitter login account",
    example: "johndoe",
  })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  username?: string;

  @ApiPropertyOptional({
    description: "Fitter first name",
    example: "John",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  firstName?: string;

  @ApiPropertyOptional({
    description: "Fitter last name",
    example: "Doe",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  lastName?: string;

  @ApiPropertyOptional({
    description: "User ID that this fitter is associated with",
    example: 123,
  })
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional({
    description: "Fitter address",
    example: "123 Main Street",
  })
  @IsOptional()
  @IsString()
  @Length(0, 255)
  address?: string;

  @ApiPropertyOptional({
    description: "Fitter postal/zip code",
    example: "10001",
  })
  @IsOptional()
  @IsString()
  @Length(0, 20)
  zipcode?: string;

  @ApiPropertyOptional({
    description: "Fitter state/province",
    example: "NY",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  state?: string;

  @ApiPropertyOptional({
    description: "Fitter city",
    example: "New York",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  city?: string;

  @ApiPropertyOptional({
    description: "Fitter country",
    example: "United States",
  })
  @IsOptional()
  @IsString()
  @Length(0, 100)
  country?: string;

  @ApiPropertyOptional({
    description: "Fitter phone number",
    example: "+1-555-123-4567",
  })
  @IsOptional()
  @IsString()
  @Length(0, 50)
  phoneNo?: string;

  @ApiPropertyOptional({
    description: "Fitter cell/mobile number",
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
    description: "Fitter email address",
    example: "fitter@example.com",
  })
  @IsOptional()
  @IsEmail()
  @Length(0, 255)
  emailaddress?: string;

  @ApiPropertyOptional({
    description: "Password for the fitter login account",
    example: "newPassword123",
  })
  @IsOptional()
  @IsString()
  @Length(6, 128)
  password?: string;
}
