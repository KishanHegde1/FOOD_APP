import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../auth/auth.module';
import { PaymentsModule } from '../../payments/payments.module';
import { UsersModule } from '../../users/users.module';
import { BookingStatusHistory } from '../bookings/entities/booking-status-history.entity';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { HotelBookingPayment } from './entities/hotel-booking-payment.entity';
import { HotelBookingPaymentTransactionLog } from './entities/hotel-booking-payment-transaction-log.entity';
import { HotelBookingPaymentWebhookEvent } from './entities/hotel-booking-payment-webhook-event.entity';
import { RazorpayRoomBookingWebhookController } from './razorpay-room-booking-webhook.controller';
import { RoomBookingPaymentsController } from './room-booking-payments.controller';
import { RoomBookingPaymentsService } from './room-booking-payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelBooking,
      BookingStatusHistory,
      HotelBookingPayment,
      HotelBookingPaymentTransactionLog,
      HotelBookingPaymentWebhookEvent,
    ]),
    AuthModule,
    UsersModule,
    PaymentsModule,
  ],
  controllers: [
    RoomBookingPaymentsController,
    RazorpayRoomBookingWebhookController,
  ],
  providers: [RoomBookingPaymentsService],
  exports: [RoomBookingPaymentsService],
})
export class RoomBookingPaymentsModule {}
