import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { HotelRoom } from './hotel-room.entity';
import { RoomAmenity } from './room-amenity.entity';

@Entity({ name: 'room_amenity_links' })
export class RoomAmenityLink {
  @PrimaryColumn({ name: 'room_id', type: 'uuid' })
  roomId!: string;

  @PrimaryColumn({ name: 'amenity_id', type: 'uuid' })
  amenityId!: string;

  @ManyToOne(() => HotelRoom, (room) => room.amenityLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'room_id' })
  room!: HotelRoom;

  @ManyToOne(() => RoomAmenity, (amenity) => amenity.roomLinks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'amenity_id' })
  amenity!: RoomAmenity;
}
