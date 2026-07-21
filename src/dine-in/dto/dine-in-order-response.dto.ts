import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DineInOrderStatus } from '../enums/dine-in-order-status.enum';
import { OrderType } from '../enums/order.enums';
import { OrderItem } from '../entities/order-item.entity';
import { Order } from '../entities/order.entity';

class DineInOrderItemResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true }) foodItemId!:
    string | null;
  @ApiProperty() name!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitPricePaise!: number;
  @ApiProperty() totalPricePaise!: number;
  @ApiPropertyOptional({ nullable: true }) specialInstructions!: string | null;
}

export class DineInOrderResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() orderNumber!: string;
  @ApiProperty({ enum: OrderType }) orderType!: OrderType;
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiPropertyOptional({ nullable: true }) sessionNumber!: string | null;
  @ApiProperty({ type: Object }) table!: {
    id: string;
    tableNumber: string;
    displayName: string | null;
  };
  @ApiProperty() roundNumber!: number;
  @ApiProperty({ enum: DineInOrderStatus }) status!: DineInOrderStatus;
  @ApiProperty({ type: [DineInOrderItemResponseDto] })
  items!: DineInOrderItemResponseDto[];
  @ApiProperty() pricing!: {
    subtotalPaise: number;
    taxPaise: number;
    serviceChargePaise: number;
    discountPaise: number;
    totalPaise: number;
  };
  @ApiPropertyOptional({ nullable: true }) rejectionReason!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) approvedAt!:
    string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) rejectedAt!:
    string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  preparationStartedAt!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) readyAt!:
    string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) servedAt!:
    string | null;

  static fromEntity(order: Order): DineInOrderResponseDto {
    const session = order.dineInSession;
    const table = order.restaurantTable;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      sessionId: order.dineInSessionId ?? '',
      sessionNumber: session?.sessionNumber ?? null,
      table: {
        id: order.restaurantTableId ?? '',
        tableNumber: table?.tableNumber ?? '',
        displayName: table?.displayName ?? null,
      },
      roundNumber: order.orderRoundNumber ?? 0,
      status: order.dineInStatus ?? DineInOrderStatus.DRAFT,
      items: (order.items ?? []).map((item) => this.item(item)),
      pricing: {
        subtotalPaise: order.itemTotalPaise,
        taxPaise: order.taxPaise,
        serviceChargePaise: order.platformFeePaise,
        discountPaise: order.discountPaise,
        totalPaise: order.grandTotalPaise,
      },
      rejectionReason: order.rejectionReason,
      createdAt: order.createdAt.toISOString(),
      approvedAt: order.approvedAt?.toISOString() ?? null,
      rejectedAt: order.rejectedAt?.toISOString() ?? null,
      preparationStartedAt: order.preparationStartedAt?.toISOString() ?? null,
      readyAt: order.readyAt?.toISOString() ?? null,
      servedAt: order.servedAt?.toISOString() ?? null,
    };
  }

  private static item(item: OrderItem): DineInOrderItemResponseDto {
    return {
      id: item.id,
      foodItemId: item.foodItemId,
      name: item.foodNameSnapshot,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      totalPricePaise: item.subtotalPaise,
      specialInstructions: item.instructions,
    };
  }
}

export class PaginatedDineInOrdersResponseDto {
  @ApiProperty({ type: [DineInOrderResponseDto] })
  items!: DineInOrderResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
