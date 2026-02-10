import { Exclude, Expose } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class User {
  @ApiProperty({
    type: String,
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({
    type: Date,
    example: "2024-01-01T12:00:00Z",
    required: false,
  })
  @Expose({ groups: ["me", "admin"] })
  lastLogin?: Date | null;

  @ApiProperty({
    type: String,
    example: "adamwhitehouse",
  })
  @Expose({ groups: ["me", "admin"] })
  username: string;

  @Exclude({ toPlainOnly: true })
  password?: string | null;

  @ApiProperty({
    type: String,
    example: "reset-token-123",
    required: false,
  })
  @Expose({ groups: ["me", "admin"] })
  resetToken?: string | null;

  @ApiProperty({
    type: Date,
    required: false,
  })
  @Expose({ groups: ["me", "admin"] })
  resetTokenExpiresAt?: Date | null;

  @ApiProperty({
    type: Boolean,
    example: true,
  })
  enabled: boolean;

  @ApiProperty({
    type: String,
    example: "adam@example.com",
  })
  @Expose({ groups: ["me", "admin"] })
  email: string | null;

  @ApiProperty({
    type: String,
    example: "123 Main Street",
    required: false,
  })
  address?: string | null;

  @ApiProperty({
    type: String,
    example: "New York",
    required: false,
  })
  city?: string | null;

  @ApiProperty({
    type: String,
    example: "10001",
    required: false,
  })
  zipcode?: string | null;

  @ApiProperty({
    type: String,
    example: "NY",
    required: false,
  })
  state?: string | null;

  @ApiProperty({
    type: String,
    example: "+1-555-123-4567",
    required: false,
  })
  cellNo?: string | null;

  @ApiProperty({
    type: String,
    example: "+1-555-987-6543",
    required: false,
  })
  phoneNo?: string | null;

  @ApiProperty({
    type: String,
    example: "US",
    required: false,
  })
  country?: string | null;

  @ApiProperty({
    type: String,
    example: "USD",
  })
  currency: string;

  @ApiProperty({
    type: String,
    example: "Adam Whitehouse",
  })
  name: string;

  @ApiProperty({
    type: String,
    example: "email",
  })
  @Expose({ groups: ["me", "admin"] })
  provider: string;

  @ApiProperty({
    type: String,
    example: "supervisor",
    description:
      "Dynamically computed role name (fitter, admin, factory, supervisor, user)",
    required: false,
  })
  typeName?: string;

  @ApiProperty({
    type: Number,
    example: 2,
    description:
      "User type from credentials table (1=fitter, 2=admin, 3=factory, 4=customsaddler)",
    required: false,
  })
  @Expose({ groups: ["me", "admin"] })
  userType?: number | null;

  @ApiProperty({
    type: Number,
    example: 0,
    description:
      "Supervisor flag from credentials table (0=not supervisor, 1=supervisor)",
    required: false,
  })
  @Expose({ groups: ["me", "admin"] })
  isSupervisor?: number | null;

  @ApiProperty({
    type: Number,
    example: 123,
    description: "Legacy user_id from credentials table",
    required: false,
  })
  legacyId?: number | null;
}
