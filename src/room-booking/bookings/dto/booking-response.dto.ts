import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../../common/enums/room-booking.enums';

export class BookingGuestResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  fullName!: string;

  @ApiPropertyOptional({ nullable: true })
  age!: number | null;

  @ApiProperty()
  isPrimaryGuest!: boolean;
}

export class BookingHotelResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true })
  city?: string | null;

  @ApiPropertyOptional({ nullable: true })
  state?: string | null;

  @ApiPropertyOptional({ nullable: true })
  country?: string | null;

  @ApiPropertyOptional({ nullable: true })
  primaryImage?: string | null;
}

export class BookingRoomResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  roomType?: string;

  @ApiPropertyOptional()
  bedType?: string;

  @ApiPropertyOptional({ nullable: true })
  primaryImage?: string | null;
}

export class HotelBookingResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  bookingNumber!: string;

  @ApiProperty({ enum: HotelBookingStatus })
  bookingStatus!: HotelBookingStatus;

  @ApiProperty({ enum: HotelPaymentMethod })
  paymentMethod!: HotelPaymentMethod;

  @ApiProperty({ enum: HotelPaymentStatus })
  paymentStatus!: HotelPaymentStatus;

  @ApiProperty({ format: 'date' })
  checkInDate!: string;

  @ApiProperty({ format: 'date' })
  checkOutDate!: string;

  @ApiProperty()
  numberOfNights!: number;

  @ApiProperty()
  roomCount!: number;

  @ApiProperty()
  adultCount!: number;

  @ApiProperty()
  childCount!: number;

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  taxAmount!: number;

  @ApiProperty()
  discountAmount!: number;

  @ApiProperty()
  totalAmount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty({ type: [Object] })
  nightlyBreakdown!: Array<Record<string, unknown>>;

  @ApiProperty({ type: BookingHotelResponseDto })
  hotel!: BookingHotelResponseDto;

  @ApiProperty({ type: BookingRoomResponseDto })
  room!: BookingRoomResponseDto;

  @ApiProperty({ type: [BookingGuestResponseDto] })
  guests!: BookingGuestResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  cancellationReason!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  confirmedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PaginatedBookingsResponseDto {
  @ApiProperty({ type: [HotelBookingResponseDto] })
  items!: HotelBookingResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
