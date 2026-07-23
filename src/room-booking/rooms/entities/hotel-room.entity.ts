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
import { BedType, RoomType } from '../../common/enums/room-booking.enums';
import type { CancellationPolicy } from '../../common/interfaces/room-booking.interfaces';
import { Hotel } from '../../hotels/entities/hotel.entity';
import { HotelBooking } from '../../bookings/entities/hotel-booking.entity';
import { RoomAmenityLink } from './room-amenity-link.entity';
import { RoomImage } from './room-image.entity';
import { RoomInventory } from './room-inventory.entity';

@Entity({ name: 'hotel_rooms' })
export class HotelRoom {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'hotel_id', type: 'uuid' })
  hotelId!: string;

  @ManyToOne(() => Hotel, (hotel) => hotel.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: Hotel;

  @Column({ name: 'name', type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({
    name: 'room_type',
    type: 'enum',
    enum: RoomType,
    enumName: 'room_type',
  })
  roomType!: RoomType;

  @Column({
    name: 'bed_type',
    type: 'enum',
    enum: BedType,
    enumName: 'bed_type',
  })
  bedType!: BedType;

  @Column({ name: 'max_adults', type: 'smallint' })
  maxAdults!: number;

  @Column({ name: 'max_children', type: 'smallint', default: 0 })
  maxChildren!: number;

  @Column({ name: 'room_size_sqft', type: 'integer', nullable: true })
  roomSizeSqft!: number | null;

  @Column({ name: 'base_price', type: 'numeric', precision: 12, scale: 2 })
  basePrice!: string;

  @Column({
    name: 'tax_percentage',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  taxPercentage!: string | null;

  @Column({ name: 'currency', type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({
    name: 'cancellation_policy',
    type: 'jsonb',
    default: () =>
      '\'{"refundable": true, "freeCancellationHours": 24}\'::jsonb',
  })
  cancellationPolicy!: CancellationPolicy;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @OneToMany(() => RoomImage, (image) => image.room)
  images?: RoomImage[];

  @OneToMany(() => RoomAmenityLink, (link) => link.room)
  amenityLinks?: RoomAmenityLink[];

  @OneToMany(() => RoomInventory, (inventory) => inventory.room)
  inventory?: RoomInventory[];

  @OneToMany(() => HotelBooking, (booking) => booking.room)
  bookings?: HotelBooking[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
