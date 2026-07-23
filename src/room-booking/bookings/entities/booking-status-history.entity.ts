import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { HotelBookingStatus } from '../../common/enums/room-booking.enums';
import { HotelBooking } from './hotel-booking.entity';

@Entity({ name: 'booking_status_history' })
export class BookingStatusHistory {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => HotelBooking, (booking) => booking.statusHistory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'booking_id' })
  booking!: HotelBooking;

  @Column({
    name: 'status',
    type: 'enum',
    enum: HotelBookingStatus,
    enumName: 'hotel_booking_status',
  })
  status!: HotelBookingStatus;

  @Column({ name: 'changed_by_user_id', type: 'uuid', nullable: true })
  changedByUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'changed_by_user_id' })
  changedByUser?: User | null;

  @Column({ name: 'reason', type: 'text', nullable: true })
  reason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
