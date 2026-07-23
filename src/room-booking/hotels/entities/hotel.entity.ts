import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HotelType } from '../../common/enums/room-booking.enums';
import { HotelAmenityLink } from './hotel-amenity-link.entity';
import { HotelImage } from './hotel-image.entity';
import { HotelRoom } from '../../rooms/entities/hotel-room.entity';
import { HotelBooking } from '../../bookings/entities/hotel-booking.entity';
import { HotelReview } from '../../reviews/entities/hotel-review.entity';

@Entity({ name: 'hotels' })
export class Hotel {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'hotel_type',
    type: 'enum',
    enum: HotelType,
    enumName: 'hotel_type',
  })
  hotelType!: HotelType;

  @Column({ name: 'star_rating', type: 'smallint', default: 0 })
  starRating!: number;

  @Column({
    name: 'average_rating',
    type: 'numeric',
    precision: 3,
    scale: 2,
    default: 0,
  })
  averageRating!: string;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  reviewCount!: number;

  @Column({ name: 'address_line', type: 'text' })
  addressLine!: string;

  @Column({ name: 'locality', type: 'varchar', length: 150, nullable: true })
  locality!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120 })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 120, nullable: true })
  state!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 80, default: 'India' })
  country!: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({
    name: 'latitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  latitude!: string | null;

  @Column({
    name: 'longitude',
    type: 'numeric',
    precision: 10,
    scale: 7,
    nullable: true,
  })
  longitude!: string | null;

  @Column({ name: 'check_in_time', type: 'time', nullable: true })
  checkInTime!: string | null;

  @Column({ name: 'check_out_time', type: 'time', nullable: true })
  checkOutTime!: string | null;

  @Column({ name: 'policies', type: 'jsonb', default: () => "'{}'::jsonb" })
  policies!: Record<string, unknown>;

  @Column({
    name: 'tax_percentage',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  taxPercentage!: string;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @OneToMany(() => HotelImage, (image) => image.hotel)
  images?: HotelImage[];

  @OneToMany(() => HotelAmenityLink, (link) => link.hotel)
  amenityLinks?: HotelAmenityLink[];

  @OneToMany(() => HotelRoom, (room) => room.hotel)
  rooms?: HotelRoom[];

  @OneToMany(() => HotelBooking, (booking) => booking.hotel)
  bookings?: HotelBooking[];

  @OneToMany(() => HotelReview, (review) => review.hotel)
  reviews?: HotelReview[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
