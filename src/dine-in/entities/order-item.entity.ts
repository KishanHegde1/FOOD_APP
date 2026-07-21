import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from './order.entity';

@Entity({ name: 'order_items' })
export class OrderItem {
  @PrimaryGeneratedColumn('uuid', { name: 'id' }) id!: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId!: string;
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order!: Order;
  @Column({ name: 'food_item_id', type: 'uuid', nullable: true }) foodItemId!:
    string | null;
  @Column({ name: 'food_name_snapshot', type: 'varchar', length: 180 })
  foodNameSnapshot!: string;
  @Column({ name: 'food_description_snapshot', type: 'text', nullable: true })
  foodDescriptionSnapshot!: string | null;
  @Column({ name: 'food_image_snapshot', type: 'text', nullable: true })
  foodImageSnapshot!: string | null;
  @Column({ name: 'unit_price_paise', type: 'integer' })
  unitPricePaise!: number;
  @Column({ name: 'quantity', type: 'integer' }) quantity!: number;
  @Column({ name: 'subtotal_paise', type: 'integer' }) subtotalPaise!: number;
  @Column({ name: 'instructions', type: 'text', nullable: true })
  instructions!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
