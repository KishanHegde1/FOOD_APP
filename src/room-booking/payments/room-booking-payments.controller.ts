import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../../auth/interfaces/firebase-user.interface';
import { UsersService } from '../../users/users.service';
import { RoomBookingPaymentVerificationResponseDto } from '../bookings/dto/booking-response.dto';
import { RecordRoomBookingPaymentFailureDto } from './dto/record-room-booking-payment-failure.dto';
import { RoomBookingPaymentResponseDto } from './dto/room-booking-payment-response.dto';
import { VerifyRoomBookingPaymentDto } from './dto/verify-room-booking-payment.dto';
import { RoomBookingPaymentsService } from './room-booking-payments.service';
import type { User } from '../../users/entities/user.entity';

@ApiTags('Room Booking - Payments')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@ApiUnauthorizedResponse({
  description: 'Firebase authentication is required.',
})
@Controller('room-booking/bookings')
export class RoomBookingPaymentsController {
  constructor(
    private readonly paymentsService: RoomBookingPaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':bookingId/payment')
  @ApiOperation({ summary: 'Get the latest payment state for a room booking' })
  @ApiOkResponse({ type: RoomBookingPaymentResponseDto })
  @ApiNotFoundResponse({ description: 'ROOM_BOOKING_PAYMENT_NOT_FOUND.' })
  getPayment(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ): Promise<RoomBookingPaymentResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.paymentsService.getForBooking(user, bookingId),
    );
  }

  @Post(':bookingId/payment-order')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Safely create a new Razorpay order for a failed room payment',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'A new stable client-generated key for this retry request.',
  })
  @ApiOkResponse({ type: RoomBookingPaymentResponseDto })
  @ApiConflictResponse({ description: 'ROOM_BOOKING_PAYMENT_NOT_RETRYABLE.' })
  @ApiTooManyRequestsResponse({ description: 'Too many payment attempts.' })
  retryPayment(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
  ): Promise<RoomBookingPaymentResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.paymentsService.retry(
        user,
        bookingId,
        this.requireIdempotencyKey(idempotencyKey ?? xIdempotencyKey),
      ),
    );
  }

  @Post(':bookingId/payments/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify Razorpay checkout and confirm a room booking',
  })
  @ApiOkResponse({ type: RoomBookingPaymentVerificationResponseDto })
  @ApiBadRequestResponse({ description: 'INVALID_GATEWAY_SIGNATURE.' })
  @ApiConflictResponse({ description: 'PAYMENT_VERIFICATION_FAILED.' })
  async verifyPayment(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: VerifyRoomBookingPaymentDto,
  ): Promise<RoomBookingPaymentVerificationResponseDto> {
    return this.withUser(firebaseUser, async (user) => {
      const result = await this.paymentsService.verify(user, bookingId, dto);
      return {
        booking: this.paymentsService.toBookingResponse(result.booking),
        payment: this.paymentsService.toResponse(result.payment),
      };
    });
  }

  @Post(':bookingId/payments/failure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Record a dismissed or failed Razorpay room checkout',
  })
  @ApiOkResponse({ type: RoomBookingPaymentResponseDto })
  recordPaymentFailure(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: RecordRoomBookingPaymentFailureDto,
  ): Promise<RoomBookingPaymentResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.paymentsService.recordFailure(user, bookingId, dto),
    );
  }

  private async withUser<T>(
    firebaseUser: FirebaseUser,
    callback: (user: User) => Promise<T>,
  ): Promise<T> {
    return callback(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key is required and must be at most 128 characters.',
      );
    }
    return key;
  }
}
