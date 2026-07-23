import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { UsersModule } from '../../users/users.module';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelReview } from './entities/hotel-review.entity';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotelReview, HotelBooking, Hotel]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
