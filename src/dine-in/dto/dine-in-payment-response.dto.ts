import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '../enums/order.enums';

export class DineInPaymentResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() paymentReference!: string;
  @ApiProperty({ format: 'uuid' }) invoiceId!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty({ enum: PaymentMethod }) method!: PaymentMethod;
  @ApiProperty({ enum: PaymentStatus }) status!: PaymentStatus;
  @ApiProperty() amountPaise!: number;
  @ApiProperty() currency!: string;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Payment gateway name. No gateway secret is returned.',
  })
  gateway!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Razorpay order ID for an online payment attempt.',
  })
  gatewayOrderId!: string | null;
  @ApiPropertyOptional({ nullable: true }) transactionReference!: string | null;
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Razorpay payment ID for a verified UPI/Card payment. Signatures are never returned.',
  })
  gatewayPaymentId!: string | null;
  @ApiPropertyOptional({ nullable: true }) restaurantName!: string | null;
  @ApiPropertyOptional({ nullable: true }) tableNumber!: string | null;
  @ApiPropertyOptional({ nullable: true }) failure!: {
    code: string | null;
    reason: string | null;
  } | null;
  @ApiProperty({ format: 'date-time' }) initiatedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) completedAt!:
    string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) failedAt!:
    string | null;
  @ApiPropertyOptional({
    description: 'Safe Razorpay Standard Checkout fields for UPI/Card only.',
  })
  checkout?: {
    gateway: 'RAZORPAY';
    keyId: string;
    orderId: string;
    amountPaise: number;
    currency: string;
  };
}

export class PaginatedDineInPaymentsResponseDto {
  @ApiProperty({ type: [DineInPaymentResponseDto] })
  items!: DineInPaymentResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
