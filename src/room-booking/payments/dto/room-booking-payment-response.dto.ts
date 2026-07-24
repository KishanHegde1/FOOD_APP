import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../../common/enums/room-booking.enums';

export class RoomBookingPaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  bookingId!: string;

  @ApiProperty()
  paymentReference!: string;

  @ApiProperty({ enum: HotelPaymentMethod })
  paymentMethod!: HotelPaymentMethod;

  @ApiProperty({ enum: HotelPaymentStatus })
  status!: HotelPaymentStatus;

  @ApiProperty({ example: 'RAZORPAY' })
  gateway!: string;

  @ApiProperty({ description: 'Amount in paise.', example: 250000 })
  amount!: number;

  @ApiProperty({ example: 'INR' })
  currency!: string;

  @ApiPropertyOptional({
    description: 'Public Razorpay Key ID. Never includes the Razorpay secret.',
    example: 'rzp_test_xxxxxxxxxx',
  })
  keyId?: string;

  @ApiPropertyOptional({ nullable: true })
  razorpayOrderId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  razorpayPaymentId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  failureReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  initiatedAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  paidAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  failedAt!: string | null;
}
