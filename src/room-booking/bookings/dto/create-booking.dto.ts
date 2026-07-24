import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HotelPaymentMethod } from '../../common/enums/room-booking.enums';
import {
  trimLowercaseStringTransform,
  trimStringTransform,
} from '../../common/utils/string-transform.util';
import { CreateBookingGuestDto } from './create-booking-guest.dto';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  hotelId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  roomId!: string;

  @ApiProperty({ format: 'date', example: '2026-08-01' })
  @IsDateString()
  checkInDate!: string;

  @ApiProperty({ format: 'date', example: '2026-08-04' })
  @IsDateString()
  checkOutDate!: string;

  @ApiProperty({ minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  roomCount!: number;

  @ApiProperty({ minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  adultCount!: number;

  @ApiProperty({ minimum: 0, maximum: 30, default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(30)
  childCount = 0;

  @ApiProperty({ example: 'Asha Sharma' })
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(120)
  contactName!: string;

  @ApiProperty({ example: '+918888888888' })
  @Transform(trimStringTransform)
  @Matches(/^\+\d{6,15}$/)
  contactPhone!: string;

  @ApiPropertyOptional({ example: 'asha@example.com' })
  @IsOptional()
  @Transform(trimLowercaseStringTransform)
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(1000)
  specialRequests?: string;

  @ApiProperty({
    enum: HotelPaymentMethod,
    example: HotelPaymentMethod.PAY_AT_HOTEL,
  })
  @IsEnum(HotelPaymentMethod)
  paymentMethod!: HotelPaymentMethod;

  @ApiPropertyOptional({
    maxLength: 128,
    description:
      'Stable client-generated key required for RAZORPAY booking creation. Header Idempotency-Key takes precedence.',
  })
  @IsOptional()
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  @ApiProperty({ type: [CreateBookingGuestDto], minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => CreateBookingGuestDto)
  guests!: CreateBookingGuestDto[];
}
