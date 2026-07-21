import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderStatus } from '../enums/order.enums';

@Entity({ name: 'order_status_history' })
export class OrderStatusHistory {
  @PrimaryGeneratedColumn('uuid', { name: 'id' }) id!: string;
  @Column({ name: 'order_id', type: 'uuid' }) orderId!: string;
  @Column({
    name: 'previous_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
    nullable: true,
  })
  previousStatus!: OrderStatus | null;
  @Column({
    name: 'new_status',
    type: 'enum',
    enum: OrderStatus,
    enumName: 'order_status',
  })
  newStatus!: OrderStatus;
  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId!: string | null;
  @Column({ name: 'note', type: 'text', nullable: true }) note!: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
