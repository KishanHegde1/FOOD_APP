import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentMethod, PaymentStatus } from '../enums/order.enums';

/**
 * Payment attempts for both legacy delivery orders and Dine-In invoices.
 * Module 14 only creates rows linked to `invoiceId` and `dineInSessionId`.
 */
@Entity({ name: 'payments' })
export class DineInPayment {
  @PrimaryGeneratedColumn('uuid', { name: 'id' }) id!: string;

  @Column({ name: 'payment_reference', type: 'varchar', nullable: true })
  paymentReference!: string | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId!: string | null;

  @Column({ name: 'dine_in_session_id', type: 'uuid', nullable: true })
  dineInSessionId!: string | null;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId!: string | null;

  @Column({ name: 'user_id', type: 'uuid' }) userId!: string;

  @Column({ name: 'restaurant_id', type: 'uuid', nullable: true })
  restaurantId!: string | null;

  @Column({
    name: 'method',
    type: 'enum',
    enum: PaymentMethod,
    enumName: 'payment_method',
  })
  method!: PaymentMethod;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PaymentStatus,
    enumName: 'payment_status',
  })
  status!: PaymentStatus;

  @Column({ name: 'amount_paise', type: 'integer' }) amountPaise!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'gateway', type: 'varchar', nullable: true })
  gateway!: string | null;

  @Column({ name: 'gateway_order_id', type: 'varchar', nullable: true })
  gatewayOrderId!: string | null;

  @Column({ name: 'gateway_payment_id', type: 'varchar', nullable: true })
  gatewayPaymentId!: string | null;

  @Column({ name: 'gateway_signature', type: 'text', nullable: true })
  gatewaySignature!: string | null;

  @Column({ name: 'gateway_event_id', type: 'varchar', nullable: true })
  gatewayEventId!: string | null;

  @Column({ name: 'transaction_reference', type: 'varchar', nullable: true })
  transactionReference!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', nullable: true })
  idempotencyKey!: string | null;

  @Column({ name: 'failure_code', type: 'varchar', nullable: true })
  failureCode!: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'cash_confirmed_by_user_id', type: 'uuid', nullable: true })
  cashConfirmedByUserId!: string | null;

  @Column({ name: 'initiated_at', type: 'timestamptz', nullable: true })
  initiatedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
