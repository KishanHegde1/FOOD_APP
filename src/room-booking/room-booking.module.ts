import { Module } from '@nestjs/common';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { FavouritesModule } from './favourites/favourites.module';
import { HotelsModule } from './hotels/hotels.module';
import { ReviewsModule } from './reviews/reviews.module';
import { RoomsModule } from './rooms/rooms.module';

@Module({
  imports: [
    HotelsModule,
    RoomsModule,
    AvailabilityModule,
    BookingsModule,
    FavouritesModule,
    ReviewsModule,
  ],
})
export class RoomBookingModule {}
