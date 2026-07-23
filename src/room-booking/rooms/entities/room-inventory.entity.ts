import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { HotelRoom } from './hotel-room.entity';

@Entity({ name: 'room_inventory' })
@Unique('UQ_room_inventory_room_date', ['roomId', 'inventoryDate'])
@Index('IDX_room_inventory_room_date', ['roomId', 'inventoryDate'])
@Check(
  'CHK_room_inventory_counts',
  '"total_inventory" >= 0 AND "reserved_inventory" >= 0 AND "blocked_inventory" >= 0 AND "reserved_inventory" + "blocked_inventory" <= "total_inventory"',
)
export class RoomInventory {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @ManyToOne(() => HotelRoom, (room) => room.inventory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'room_id' })
  room!: HotelRoom;

  @Column({ name: 'inventory_date', type: 'date' })
  inventoryDate!: string;

  @Column({ name: 'total_inventory', type: 'integer' })
  totalInventory!: number;

  @Column({ name: 'reserved_inventory', type: 'integer', default: 0 })
  reservedInventory!: number;

  @Column({ name: 'blocked_inventory', type: 'integer', default: 0 })
  blockedInventory!: number;

  @Column({
    name: 'price_override',
    type: 'numeric',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  priceOverride!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
