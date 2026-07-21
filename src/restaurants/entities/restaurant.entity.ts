import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum RestaurantStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

@Entity({ name: 'restaurants' })
export class Restaurant {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId!: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User;

  @Column({ name: 'name', type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 220, nullable: true })
  slug!: string | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'banner_url', type: 'text', nullable: true })
  bannerUrl!: string | null;

  @Column({ name: 'address_line', type: 'text' })
  addressLine!: string;

  @Column({ name: 'locality', type: 'varchar', length: 150, nullable: true })
  locality!: string | null;

  @Column({ name: 'city', type: 'varchar', length: 120 })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 120, nullable: true })
  state!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'country', type: 'varchar', length: 80, default: 'India' })
  country!: string;

  @Column({ name: 'latitude', type: 'numeric', nullable: true })
  latitude!: number | null;

  @Column({ name: 'longitude', type: 'numeric', nullable: true })
  longitude!: number | null;

  @Column({ name: 'rating', type: 'numeric', default: 0 })
  rating!: number;

  @Column({ name: 'review_count', type: 'integer', default: 0 })
  reviewCount!: number;

  @Column({
    name: 'average_delivery_minutes',
    type: 'integer',
    default: 30,
  })
  averageDeliveryMinutes!: number;

  @Column({ name: 'delivery_fee_paise', type: 'integer', default: 0 })
  deliveryFeePaise!: number;

  @Column({ name: 'minimum_order_paise', type: 'integer', default: 0 })
  minimumOrderPaise!: number;

  @Column({ name: 'service_radius_km', type: 'numeric', default: 5 })
  serviceRadiusKm!: number;

  @Column({ name: 'is_open', type: 'boolean', default: true })
  isOpen!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'is_pure_veg', type: 'boolean', default: false })
  isPureVeg!: boolean;

  @Column({
    name: 'status',
    type: 'enum',
    enum: RestaurantStatus,
    enumName: 'restaurant_status',
    default: RestaurantStatus.PENDING,
  })
  status!: RestaurantStatus;

  @Column({ name: 'opening_time', type: 'time', nullable: true })
  openingTime!: string | null;

  @Column({ name: 'closing_time', type: 'time', nullable: true })
  closingTime!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
