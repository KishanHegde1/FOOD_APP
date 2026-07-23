import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelAmenityLink } from './entities/hotel-amenity-link.entity';
import { HotelAmenity } from './entities/hotel-amenity.entity';
import { HotelImage } from './entities/hotel-image.entity';
import { Hotel } from './entities/hotel.entity';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      HotelImage,
      HotelAmenity,
      HotelAmenityLink,
    ]),
  ],
  controllers: [HotelsController],
  providers: [HotelsService],
  exports: [HotelsService],
})
export class HotelsModule {}
