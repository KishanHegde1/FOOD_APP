import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Hotel } from './hotel.entity';
import { HotelAmenity } from './hotel-amenity.entity';

@Entity({ name: 'hotel_amenity_links' })
export class HotelAmenityLink {
  @PrimaryColumn({ name: 'hotel_id', type: 'uuid' })
  hotelId!: string;

  @PrimaryColumn({ name: 'amenity_id', type: 'uuid' })
  amenityId!: string;

  @ManyToOne(() => Hotel, (hotel) => hotel.amenityLinks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'hotel_id' })
  hotel!: Hotel;

  @ManyToOne(() => HotelAmenity, (amenity) => amenity.hotelLinks, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'amenity_id' })
  amenity!: HotelAmenity;
}
