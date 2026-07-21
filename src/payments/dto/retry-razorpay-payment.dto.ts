import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PaymentMethod } from '../../dine-in/enums/order.enums';

export class RetryRazorpayPaymentDto {
  @ApiProperty({ enum: [PaymentMethod.UPI, PaymentMethod.CARD] })
  @IsIn([PaymentMethod.UPI, PaymentMethod.CARD])
  method!: PaymentMethod.UPI | PaymentMethod.CARD;
}
