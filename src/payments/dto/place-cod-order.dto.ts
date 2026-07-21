import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class PlaceCodOrderDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Active delivery address owned by the authenticated customer.',
  })
  @IsOptional()
  @IsUUID()
  addressId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Backward-compatible alias for addressId.',
  })
  @IsOptional()
  @IsUUID()
  deliveryAddressId?: string;

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

  @ApiPropertyOptional({
    maxLength: 128,
    description:
      'Body fallback for clients that cannot send X-Idempotency-Key.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
