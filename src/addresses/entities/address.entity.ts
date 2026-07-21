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

export enum AddressLabel {
  HOME = 'HOME',
  WORK = 'WORK',
  OTHER = 'OTHER',
}

@Entity({ name: 'addresses' })
export class Address {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    name: 'label',
    type: 'enum',
    enum: AddressLabel,
    enumName: 'address_label',
  })
  label!: AddressLabel;

  @Column({ name: 'recipient_name', type: 'varchar' })
  recipientName!: string;

  @Column({ name: 'phone', type: 'varchar' })
  phone!: string;

  @Column({ name: 'address_line', type: 'text' })
  addressLine!: string;

  @Column({ name: 'locality', type: 'varchar', nullable: true })
  locality!: string | null;

  @Column({ name: 'landmark', type: 'varchar', nullable: true })
  landmark!: string | null;

  @Column({ name: 'city', type: 'varchar' })
  city!: string;

  @Column({ name: 'state', type: 'varchar', nullable: true })
  state!: string | null;

  @Column({ name: 'postal_code', type: 'varchar' })
  postalCode!: string;

  @Column({ name: 'country', type: 'varchar', default: 'India' })
  country!: string;

  @Column({ name: 'latitude', type: 'numeric', nullable: true })
  latitude!: number | null;

  @Column({ name: 'longitude', type: 'numeric', nullable: true })
  longitude!: number | null;

  @Column({
    name: 'location',
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  location!: string | null;

  @Column({ name: 'is_default', type: 'boolean', default: false })
  isDefault!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
