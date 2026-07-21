import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class VerifyRazorpayPaymentDto {
  @ApiProperty({ example: 'order_Nxxxxxxx' })
  @IsString()
  @MaxLength(120)
  gatewayOrderId!: string;

  @ApiProperty({ example: 'pay_Nxxxxxxx' })
  @IsString()
  @MaxLength(120)
  gatewayPaymentId!: string;

  @ApiProperty({ description: 'razorpay_signature from checkout callback.' })
  @IsString()
  @MaxLength(500)
  gatewaySignature!: string;
}
