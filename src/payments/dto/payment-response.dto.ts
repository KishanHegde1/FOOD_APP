import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../dine-in/enums/order.enums';

export class PaymentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() paymentReference!: string;
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ format: 'uuid' }) restaurantId!: string;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty({ enum: OrderStatus }) orderStatus!: OrderStatus;
  @ApiProperty({ enum: PaymentStatus }) orderPaymentStatus!: PaymentStatus;
  @ApiProperty() amountPaise!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional({ nullable: true }) transactionReference!: string | null;
  @ApiPropertyOptional({ nullable: true })
  failure!: { code: string | null; reason: string | null } | null;
  @ApiProperty({ format: 'date-time' }) initiatedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  completedAt!: string | null;
  @ApiPropertyOptional({
    description:
      'Safe Razorpay Standard Checkout fields. Secrets are never returned.',
  })
  checkout?: {
    gateway: 'RAZORPAY';
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
    method: PaymentMethod.UPI | PaymentMethod.CARD;
  };
}

export class PaginatedPaymentResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] }) items!: PaymentResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
