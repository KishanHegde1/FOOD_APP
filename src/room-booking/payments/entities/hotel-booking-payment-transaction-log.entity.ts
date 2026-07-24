import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'hotel_booking_payment_transaction_logs' })
export class HotelBookingPaymentTransactionLog {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId!: string | null;

  @Column({ name: 'booking_id', type: 'uuid', nullable: true })
  bookingId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 80 })
  eventType!: string;

  @Column({ name: 'status_from', type: 'varchar', length: 40, nullable: true })
  statusFrom!: string | null;

  @Column({ name: 'status_to', type: 'varchar', length: 40, nullable: true })
  statusTo!: string | null;

  @Column({ name: 'gateway', type: 'varchar', length: 40, nullable: true })
  gateway!: string | null;

  @Column({ name: 'gateway_order_id', type: 'varchar', nullable: true })
  gatewayOrderId!: string | null;

  @Column({ name: 'gateway_payment_id', type: 'varchar', nullable: true })
  gatewayPaymentId!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
