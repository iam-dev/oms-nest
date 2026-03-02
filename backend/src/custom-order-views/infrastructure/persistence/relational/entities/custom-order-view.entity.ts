import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity("custom_order_views")
@Index("idx_custom_order_views_user_id", ["userId"])
@Index("idx_custom_order_views_is_default", ["isDefault"])
export class CustomOrderViewEntity {
  @PrimaryGeneratedColumn("increment")
  id: number | undefined;

  @Column({ name: "user_id", type: "integer", nullable: false })
  userId: number | undefined;

  @Column({ name: "name", type: "varchar", length: 255, nullable: false })
  name: string | undefined;

  @Column({
    name: "columns",
    type: "jsonb",
    nullable: false,
    default: () => "'[]'",
  })
  columns:
    | Array<{
        key: string;
        label: string;
        visible: boolean;
        order: number;
      }>
    | undefined;

  @Column({ name: "group_id", type: "integer", nullable: true })
  groupId: number | null | undefined;

  @Column({ name: "tab_order", type: "integer", default: 0, nullable: false })
  tabOrder: number | undefined;

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
