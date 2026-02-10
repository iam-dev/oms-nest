import {
  Column,
  Entity,
  Index,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from "typeorm";

import { AuthProvidersEnum } from "../../../../../auth/auth-providers.enum";

@Entity({
  name: "user",
})
@Index("user_username_index", ["username"], { unique: true })
@Index("user_email_index", ["email"], { unique: true })
export class UserEntity {
  @PrimaryColumn({ type: "uuid" })
  id: string;

  @Column({
    type: "timestamp",
    nullable: true,
    name: "last_login",
  })
  lastLogin?: Date | null;

  @Index()
  @Column({ type: String, unique: true, nullable: false })
  username: string;

  @Column({ type: String, nullable: true })
  password?: string | null;

  @Column({ type: String, nullable: true, name: "reset_token" })
  resetToken?: string | null;

  @Column({ type: "timestamp", nullable: true, name: "reset_token_expires_at" })
  resetTokenExpiresAt?: Date | null;

  @Column({
    type: Boolean,
    nullable: false,
    default: true,
    transformer: {
      to: (value: boolean) => value,
      from: (value: any) => {
        if (value === null || value === undefined) return true;
        if (typeof value === "string")
          return value.toLowerCase() === "true" || value === "1";
        if (typeof value === "number") return value === 1;
        return Boolean(value);
      },
    },
  })
  enabled: boolean;

  @Column({ type: String, unique: true, nullable: true })
  email: string | null;

  @Column({ type: String, nullable: true })
  address?: string | null;

  @Column({ type: String, nullable: true })
  city?: string | null;

  @Column({ type: String, nullable: true })
  zipcode?: string | null;

  @Column({ type: String, nullable: true })
  state?: string | null;

  @Column({ type: String, nullable: true, name: "cell_no" })
  cellNo?: string | null;

  @Column({ type: String, nullable: true, name: "phone_no" })
  phoneNo?: string | null;

  @Column({ type: String, nullable: true })
  country?: string | null;

  @Column({ type: String, nullable: false })
  currency: string;

  @Column({ type: String, nullable: false })
  name: string;

  @Column({ type: "integer", name: "user_type", nullable: true })
  userType?: number | null;

  @Column({ type: "smallint", name: "is_supervisor", nullable: true })
  isSupervisor?: number | null;

  @Column({ type: "integer", name: "legacy_id", nullable: true })
  legacyId?: number | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt?: Date | null;

  // Add provider for compatibility with auth system (not in staging DB)
  provider: string = AuthProvidersEnum.email;

  // Computed properties for business logic
  get isActive(): boolean {
    return this.enabled && !this.deletedAt;
  }

  get fullName(): string {
    return this.name || this.username;
  }

  get primaryContact(): string {
    return this.email || this.cellNo || this.phoneNo || "";
  }

  get fullAddress(): string {
    const parts = [
      this.address,
      this.city,
      this.state,
      this.zipcode,
      this.country,
    ].filter((part) => part && part.trim() !== "");
    return parts.join(", ");
  }

  constructor() {
    this.enabled = true;
  }
}
