import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { AvailabilityModule } from '../availability/availability.module';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from '../rooms/entities/hotel-room.entity';
import { RoomInventory } from '../rooms/entities/room-inventory.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { BookingGuest } from './entities/booking-guest.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { HotelBooking } from './entities/hotel-booking.entity';
import { RoomBookingPaymentsModule } from '../payments/room-booking-payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hotel,
      HotelRoom,
      RoomInventory,
      HotelBooking,
      BookingGuest,
      BookingStatusHistory,
    ]),
    AvailabilityModule,
    RoomBookingPaymentsModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
