import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DineInBillingSnapshot } from '../entities/dine-in-invoice.entity';
import { DineInInvoiceStatus } from '../enums/dine-in-invoice-status.enum';

export class DineInInvoiceResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() invoiceNumber!: string;
  @ApiProperty({ enum: DineInInvoiceStatus }) status!: DineInInvoiceStatus;
  @ApiProperty() session!: {
    id: string;
    sessionNumber: string;
    status: string;
  };
  @ApiProperty() restaurant!: { id: string; name: string };
  @ApiProperty() table!: { id: string; tableNumber: string };
  @ApiProperty() orders!: DineInBillingSnapshot['orders'];
  @ApiProperty()
  pricing!: {
    subtotalPaise: number;
    taxPaise: number;
    serviceChargePaise: number;
    discountPaise: number;
    totalPaise: number;
    currency: string;
  };
  @ApiProperty() itemCount!: number;
  @ApiProperty() orderCount!: number;
  @ApiProperty({ format: 'date-time' }) requestedAt!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) confirmedAt!:
    string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true }) paidAt!:
    string | null;
}

export class PaginatedDineInInvoicesResponseDto {
  @ApiProperty({ type: [DineInInvoiceResponseDto] })
  items!: DineInInvoiceResponseDto[];
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty() total!: number;
  @ApiProperty() totalPages!: number;
}
