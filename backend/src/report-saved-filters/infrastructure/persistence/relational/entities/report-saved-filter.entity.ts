import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("report_saved_filters")
@Index("idx_report_saved_filters_user_id", ["userId"])
@Index("idx_report_saved_filters_is_default", ["isDefault"])
export class ReportSavedFilterEntity {
  @PrimaryGeneratedColumn("increment")
  id: number | undefined;

  @Column({ name: "user_id", type: "integer", nullable: false })
  userId: number | undefined;

  @Column({ name: "name", type: "varchar", length: 255, nullable: false })
  name: string | undefined;

  @Column({
    name: "filters",
    type: "jsonb",
    nullable: false,
    default: () => "'{}'",
  })
  filters: Record<string, unknown> | undefined;

  @Column({
    name: "is_default",
    type: "boolean",
    default: false,
    nullable: false,
  })
  isDefault: boolean | undefined;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date | undefined;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date | undefined;
}
