import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import {
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../../common/enums/room-booking.enums';
import { HotelBooking } from '../../bookings/entities/hotel-booking.entity';

@Entity({ name: 'hotel_booking_payments' })
@Index('IDX_hotel_booking_payments_booking_created', ['bookingId', 'createdAt'])
@Index('IDX_hotel_booking_payments_user_created', ['userId', 'createdAt'])
export class HotelBookingPayment {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'payment_reference', type: 'varchar', length: 64 })
  paymentReference!: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => HotelBooking, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'booking_id' })
  booking!: HotelBooking;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: HotelPaymentMethod,
    enumName: 'hotel_payment_method',
  })
  paymentMethod!: HotelPaymentMethod;

  @Column({
    name: 'status',
    type: 'enum',
    enum: HotelPaymentStatus,
    enumName: 'hotel_payment_status',
  })
  status!: HotelPaymentStatus;

  @Column({ name: 'amount_paise', type: 'integer' })
  amountPaise!: number;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'gateway', type: 'varchar', length: 40 })
  gateway!: string;

  @Column({ name: 'gateway_order_id', type: 'varchar', nullable: true })
  gatewayOrderId!: string | null;

  @Column({ name: 'gateway_payment_id', type: 'varchar', nullable: true })
  gatewayPaymentId!: string | null;

  @Column({ name: 'gateway_signature', type: 'text', nullable: true })
  gatewaySignature!: string | null;

  @Column({ name: 'gateway_event_id', type: 'varchar', nullable: true })
  gatewayEventId!: string | null;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 128 })
  idempotencyKey!: string;

  @Column({ name: 'failure_code', type: 'varchar', nullable: true })
  failureCode!: string | null;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason!: string | null;

  @Column({ name: 'initiated_at', type: 'timestamptz' })
  initiatedAt!: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt!: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
