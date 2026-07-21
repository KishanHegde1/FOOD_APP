import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'restaurant_tables' })
export class RestaurantTable {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'restaurant_id', type: 'uuid' })
  restaurantId!: string;

  @Column({ name: 'table_number', type: 'varchar' })
  tableNumber!: string;

  @Column({ name: 'display_name', type: 'varchar', nullable: true })
  displayName!: string | null;

  @Column({ name: 'capacity', type: 'integer', default: 4 })
  capacity!: number;

  @Column({ name: 'qr_token_hash', type: 'varchar' })
  qrTokenHash!: string;

  @Column({ name: 'qr_token_version', type: 'integer', default: 1 })
  qrTokenVersion!: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
