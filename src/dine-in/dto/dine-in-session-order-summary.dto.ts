import { ApiProperty } from '@nestjs/swagger';
import { DineInSessionStatus } from '../enums/dine-in-session-status.enum';

export class DineInSessionOrderSummaryDto {
  @ApiProperty({ format: 'uuid' }) sessionId!: string;
  @ApiProperty() sessionNumber!: string;
  @ApiProperty() restaurant!: { id: string; name: string };
  @ApiProperty() table!: { id: string; tableNumber: string };
  @ApiProperty({ enum: DineInSessionStatus })
  sessionStatus!: DineInSessionStatus;
  @ApiProperty() totalRounds!: number;
  @ApiProperty() activeOrderCount!: number;
  @ApiProperty() servedOrderCount!: number;
  @ApiProperty() rejectedOrderCount!: number;
  @ApiProperty() cancelledOrderCount!: number;
  @ApiProperty()
  pricing!: {
    subtotalPaise: number;
    taxPaise: number;
    serviceChargePaise: number;
    discountPaise: number;
    payableTotalPaise: number;
  };
  @ApiProperty({ description: 'True only while the session is ACTIVE.' })
  canAddMoreItems!: boolean;
}
