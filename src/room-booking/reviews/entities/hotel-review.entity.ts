import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { HotelBooking } from '../../bookings/entities/hotel-booking.entity';
import { Hotel } from '../../hotels/entities/hotel.entity';

@Entity({ name: 'hotel_reviews' })
@Unique('UQ_hotel_reviews_booking', ['bookingId'])
@Check('CHK_hotel_reviews_rating', '"rating" BETWEEN 1 AND 5')
export class HotelReview {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId!: string;

  @ManyToOne(() => Hotel, (hotel) => hotel.reviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: Hotel;

  @Column({ name: 'booking_id', type: 'uuid' })
  bookingId!: string;

  @ManyToOne(() => HotelBooking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking!: HotelBooking;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'rating', type: 'smallint' })
  rating!: number;

  @Column({ name: 'title', type: 'varchar', length: 160, nullable: true })
  title!: string | null;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'is_approved', type: 'boolean', default: true })
  isApproved!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
