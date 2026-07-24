import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiHeader,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../../auth/interfaces/firebase-user.interface';
import { UsersService } from '../../users/users.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import {
  HotelBookingResponseDto,
  PaginatedBookingsResponseDto,
  RoomBookingCheckoutResponseDto,
} from './dto/booking-response.dto';
import { BookingsService } from './bookings.service';

@ApiTags('Room Booking - Bookings')
@Controller('room-booking/bookings')
@UseGuards(FirebaseAuthGuard)
@ApiBearerAuth('firebase-auth')
@ApiExtraModels(HotelBookingResponseDto, RoomBookingCheckoutResponseDto)
@ApiUnauthorizedResponse({
  description: 'Firebase authentication is required.',
})
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly usersService: UsersService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Create a Pay at Hotel booking or reserve a room and create a Razorpay checkout order',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Required for RAZORPAY bookings. A stable client-generated key prevents duplicate booking/payment attempts.',
  })
  @ApiCreatedResponse({
    description:
      'A confirmed Pay at Hotel booking, or a pending Razorpay booking with checkout details.',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(HotelBookingResponseDto) },
        { $ref: getSchemaPath(RoomBookingCheckoutResponseDto) },
      ],
    },
  })
  @ApiBadRequestResponse({ description: 'Invalid booking request.' })
  @ApiConflictResponse({
    description: 'Room availability, occupancy, or booking conflict.',
  })
  @ApiNotFoundResponse({ description: 'Hotel or room not found.' })
  create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Body() dto: CreateBookingDto,
  ): Promise<HotelBookingResponseDto | RoomBookingCheckoutResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.bookingsService.createBooking(
        user,
        dto,
        idempotencyKey ?? xIdempotencyKey,
      ),
    );
  }

  @Get('my')
  @ApiOperation({ summary: 'List authenticated user bookings' })
  @ApiOkResponse({ type: PaginatedBookingsResponseDto })
  findMine(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Query() query: BookingQueryDto,
  ): Promise<PaginatedBookingsResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.bookingsService.findMyBookings(user, query),
    );
  }

  @Get('my/:bookingId')
  @ApiOperation({ summary: 'Get one authenticated user booking' })
  @ApiOkResponse({ type: HotelBookingResponseDto })
  @ApiNotFoundResponse({ description: 'Booking not found.' })
  findOneMine(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ): Promise<HotelBookingResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.bookingsService.findMyBooking(user, bookingId),
    );
  }

  @Patch(':bookingId/cancel')
  @ApiOperation({ summary: 'Cancel an eligible authenticated user booking' })
  @ApiOkResponse({ type: HotelBookingResponseDto })
  @ApiForbiddenResponse({ description: 'Booking ownership is required.' })
  @ApiConflictResponse({ description: 'Booking cannot be cancelled safely.' })
  cancel(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
    @Body() dto: CancelBookingDto,
  ): Promise<HotelBookingResponseDto> {
    return this.withUser(firebaseUser, (user) =>
      this.bookingsService.cancelBooking(user, bookingId, dto),
    );
  }

  private async withUser<T>(
    firebaseUser: FirebaseUser,
    callback: (
      user: Awaited<ReturnType<UsersService['findActiveByFirebaseUid']>>,
    ) => Promise<T>,
  ): Promise<T> {
    return callback(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }
}
