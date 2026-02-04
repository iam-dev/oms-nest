import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from "typeorm";

/**
 * OrderLine TypeORM Entity
 *
 * Represents the order_line table structure in the database.
 * Tracks individual line items within an order including products,
 * quantities, pricing, and sequencing information.
 */
@Entity("order_line")
@Index(["orderId"])
@Index(["productId"])
@Index(["orderId", "sequence"])
@Index(["createdAt"])
@Index(["deletedAt"])
export class OrderLineEntity {
  @PrimaryGeneratedColumn("increment")
  id: number;

  @Column({ name: "order_id", type: "integer" })
  orderId: number;

  @Column({ name: "product_id", type: "integer", nullable: true })
  productId: number | null;

  @Column({
    type: "int",
    default: 1,
  })
  quantity: number;

  @Column({
    name: "unit_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  unitPrice: number;

  @Column({
    name: "total_price",
    type: "decimal",
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseFloat(value),
    },
  })
  totalPrice: number;

  @Column({ type: "text", nullable: true })
  notes: string | null;

  @Column({
    type: "int",
    default: 0,
  })
  sequence: number;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;

  @DeleteDateColumn({ name: "deleted_at", nullable: true })
  deletedAt: Date | null;

  constructor() {
    this.quantity = 1;
    this.sequence = 0;
    this.productId = null;
    this.notes = null;
  }
}
