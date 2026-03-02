import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("custom_order_cell_overrides")
@Index("idx_cell_overrides_user_id", ["userId"])
@Index("idx_cell_overrides_order_id", ["orderId"])
export class CustomOrderCellOverrideEntity {
  @PrimaryGeneratedColumn("increment")
  id: number | undefined;

  @Column({ name: "user_id", type: "integer", nullable: false })
  userId: number | undefined;

  @Column({ name: "order_id", type: "integer", nullable: false })
  orderId: number | undefined;

  @Column({ name: "column_key", type: "varchar", length: 255, nullable: false })
  columnKey: string | undefined;

  @Column({ name: "override_value", type: "text", nullable: false })
  overrideValue: string | undefined;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date | undefined;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date | undefined;
}
