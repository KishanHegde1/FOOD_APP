import { ApiProperty } from '@nestjs/swagger';

export class DineInManagerDashboardResponseDto {
  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty({ format: 'date-time' })
  generatedAt!: string;

  @ApiProperty()
  sessions!: {
    active: number;
    billRequested: number;
    paymentPending: number;
  };

  @ApiProperty()
  orders!: {
    pendingApproval: number;
    approved: number;
    preparing: number;
    ready: number;
    served: number;
    activeTotalPaise: number;
  };

  @ApiProperty()
  billing!: {
    requestedBills: number;
    paymentPendingBills: number;
    amountAwaitingPaymentPaise: number;
  };

  @ApiProperty()
  cash!: {
    awaitingConfirmationCount: number;
    awaitingConfirmationAmountPaise: number;
  };
}
