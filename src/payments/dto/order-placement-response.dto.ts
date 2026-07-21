import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus, PaymentStatus } from '../../dine-in/enums/order.enums';

export class OrderPlacementSummaryDto {
  @ApiProperty({ format: 'uuid' }) orderId!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: ['COD', 'UPI', 'CARD'] }) paymentMethod!:
    'COD' | 'UPI' | 'CARD';
  @ApiProperty({ enum: PaymentStatus }) paymentStatus!: PaymentStatus;
  @ApiProperty({ enum: OrderStatus }) orderStatus!: OrderStatus;
  @ApiProperty({ description: 'Total amount in rupees for legacy Flutter UI.' })
  total!: number;
  @ApiProperty({ description: 'Total amount in paise.' }) totalPaise!: number;
}

export class OrderPlacementResponseDto {
  @ApiProperty() success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: OrderPlacementSummaryDto })
  data!: OrderPlacementSummaryDto;
}
