import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/order.enums';

export class InitiateDineInPaymentDto {
  @ApiProperty({
    enum: [PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.CARD],
  })
  @IsEnum([PaymentMethod.CASH, PaymentMethod.UPI, PaymentMethod.CARD])
  method!: PaymentMethod.CASH | PaymentMethod.UPI | PaymentMethod.CARD;
}
