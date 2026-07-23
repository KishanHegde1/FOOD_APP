import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../../common/enums/room-booking.enums';
import { BookingPricingSnapshot } from '../../common/interfaces/room-booking.interfaces';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { HotelRoom } from '../../rooms/entities/hotel-room.entity';
import { BookingGuest } from './booking-guest.entity';
import { BookingStatusHistory } from './booking-status-history.entity';

@Entity({ name: 'hotel_bookings' })
export class HotelBooking {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'booking_number', type: 'varchar', length: 40 })
  bookingNumber!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId!: string;

  @ManyToOne(() => Hotel, (hotel) => hotel.bookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: Hotel;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => HotelRoom, (room) => room.bookings, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'room_id' })
  room!: HotelRoom;

  @Column({ name: 'check_in_date', type: 'date' })
  checkInDate!: string;

  @Column({ name: 'check_out_date', type: 'date' })
  checkOutDate!: string;

  @Column({ name: 'number_of_nights', type: 'integer' })
  numberOfNights!: number;

  @Column({ name: 'room_count', type: 'integer' })
  roomCount!: number;

  @Column({ name: 'adult_count', type: 'integer' })
  adultCount!: number;

  @Column({ name: 'child_count', type: 'integer', default: 0 })
  childCount!: number;

  @Column({ name: 'contact_name', type: 'varchar', length: 120 })
  contactName!: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20 })
  contactPhone!: string;

  @Column({
    name: 'contact_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  contactEmail!: string | null;

  @Column({ name: 'special_requests', type: 'text', nullable: true })
  specialRequests!: string | null;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: HotelPaymentMethod,
    enumName: 'hotel_payment_method',
  })
  paymentMethod!: HotelPaymentMethod;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: HotelPaymentStatus,
    enumName: 'hotel_payment_status',
  })
  paymentStatus!: HotelPaymentStatus;

  @Column({
    name: 'booking_status',
    type: 'enum',
    enum: HotelBookingStatus,
    enumName: 'hotel_booking_status',
  })
  bookingStatus!: HotelBookingStatus;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'nightly_price_breakdown', type: 'jsonb' })
  nightlyPriceBreakdown!: BookingPricingSnapshot['nightlyBreakdown'];

  @Column({ name: 'subtotal', type: 'numeric', precision: 12, scale: 2 })
  subtotal!: string;

  @Column({
    name: 'tax_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  taxAmount!: string;

  @Column({
    name: 'discount_amount',
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount!: string;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2 })
  totalAmount!: string;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt!: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt!: Date | null;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt!: Date | null;

  @Column({ name: 'checked_out_at', type: 'timestamptz', nullable: true })
  checkedOutAt!: Date | null;

  @OneToMany(() => BookingGuest, (guest) => guest.booking)
  guests?: BookingGuest[];

  @OneToMany(() => BookingStatusHistory, (history) => history.booking)
  statusHistory?: BookingStatusHistory[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
