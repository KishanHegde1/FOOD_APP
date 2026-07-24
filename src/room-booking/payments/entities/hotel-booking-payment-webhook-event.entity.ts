import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'hotel_booking_payment_webhook_events' })
export class HotelBookingPaymentWebhookEvent {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'gateway', type: 'varchar', length: 40 })
  gateway!: string;

  @Column({ name: 'event_id', type: 'varchar', nullable: true })
  eventId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType!: string;

  @Column({ name: 'gateway_order_id', type: 'varchar', nullable: true })
  gatewayOrderId!: string | null;

  @Column({ name: 'gateway_payment_id', type: 'varchar', nullable: true })
  gatewayPaymentId!: string | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId!: string | null;

  @Column({ name: 'processed', type: 'boolean', default: false })
  processed!: boolean;

  @Column({ name: 'ignored_reason', type: 'text', nullable: true })
  ignoredReason!: string | null;

  @Column({ name: 'payload', type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
