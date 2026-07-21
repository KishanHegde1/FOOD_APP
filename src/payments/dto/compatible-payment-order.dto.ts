import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CompatiblePaymentOrderDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

  @ApiPropertyOptional({
    description: 'UPI, CARD, COD, or CASH_ON_DELIVERY.',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  paymentMethod?: string;

  @ApiPropertyOptional({
    description: 'Backward-compatible alias for paymentMethod.',
    maxLength: 40,
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  method?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  upiId?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 50 })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  couponCode?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  deliveryInstructions?: string | null;

  @ApiPropertyOptional({ maxLength: 128 })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
