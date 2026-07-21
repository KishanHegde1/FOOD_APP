import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DineInOrderStatus } from '../enums/dine-in-order-status.enum';

@Entity({ name: 'kitchen_tickets' })
export class KitchenTicket {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ name: 'dine_in_session_id', type: 'uuid' })
  dineInSessionId!: string;

  @Column({ name: 'restaurant_table_id', type: 'uuid' })
  restaurantTableId!: string;

  @Column({ name: 'ticket_number', type: 'varchar' })
  ticketNumber!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DineInOrderStatus,
    enumName: 'dine_in_order_status',
    default: DineInOrderStatus.APPROVED,
  })
  status!: DineInOrderStatus;

  @Column({ name: 'accepted_by_user_id', type: 'uuid', nullable: true })
  acceptedByUserId!: string | null;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt!: Date | null;

  @Column({
    name: 'preparation_started_at',
    type: 'timestamptz',
    nullable: true,
  })
  preparationStartedAt!: Date | null;

  @Column({ name: 'ready_at', type: 'timestamptz', nullable: true })
  readyAt!: Date | null;

  @Column({ name: 'served_at', type: 'timestamptz', nullable: true })
  servedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
