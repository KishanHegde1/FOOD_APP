import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityModule } from '../availability/availability.module';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from './entities/hotel-room.entity';
import { RoomAmenityLink } from './entities/room-amenity-link.entity';
import { RoomAmenity } from './entities/room-amenity.entity';
import { RoomImage } from './entities/room-image.entity';
import { RoomInventory } from './entities/room-inventory.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      HotelRoom,
      RoomImage,
      RoomAmenity,
      RoomAmenityLink,
      RoomInventory,
    ]),
    AvailabilityModule,
  ],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
