import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaymentMethod } from '../../dine-in/enums/order.enums';

export class CreateRazorpayOrderDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Active delivery address owned by the authenticated customer.',
  })
  @IsUUID()
  deliveryAddressId!: string;

  @ApiProperty({
    enum: [PaymentMethod.UPI, PaymentMethod.CARD],
    description: 'Online method to expose to Razorpay Standard Checkout.',
  })
  @IsIn([PaymentMethod.UPI, PaymentMethod.CARD])
  method!: PaymentMethod.UPI | PaymentMethod.CARD;

  @ApiPropertyOptional({
    maxLength: 500,
    description: 'Optional delivery instructions copied to the created order.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryInstructions?: string;
}
