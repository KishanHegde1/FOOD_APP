import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VerifyRoomBookingPaymentDto {
  @ApiProperty({ example: 'order_Qxxxxxxxx' })
  @IsString()
  @MaxLength(120)
  razorpayOrderId!: string;

  @ApiProperty({ example: 'pay_Qxxxxxxxx' })
  @IsString()
  @MaxLength(120)
  razorpayPaymentId!: string;

  @ApiProperty({ description: 'razorpay_signature returned by checkout.' })
  @IsString()
  @MaxLength(500)
  razorpaySignature!: string;
}
