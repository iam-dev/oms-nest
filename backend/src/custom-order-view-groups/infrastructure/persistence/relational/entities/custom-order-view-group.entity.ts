import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("custom_order_view_groups")
@Index("idx_custom_order_view_groups_user_id", ["userId"])
export class CustomOrderViewGroupEntity {
  @PrimaryGeneratedColumn("increment")
  id: number | undefined;

  @Column({ name: "user_id", type: "integer", nullable: false })
  userId: number | undefined;

  @Column({ name: "name", type: "varchar", length: 255, nullable: false })
  name: string | undefined;

  @CreateDateColumn({ name: "created_at", type: "timestamp" })
  createdAt: Date | undefined;

  @UpdateDateColumn({ name: "updated_at", type: "timestamp" })
  updatedAt: Date | undefined;
}
