import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { trimString } from './dine-in-dto-transformers';

export class CancelDineInPaymentDto {
  @ApiPropertyOptional({
    maxLength: 64,
    example: 'CHECKOUT_CANCELLED',
    description: 'Optional client cancellation code for diagnostics.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_.-]+$/, {
    message:
      'code may contain only letters, numbers, dots, dashes, and underscores.',
  })
  code?: string;

  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Customer closed Razorpay Checkout.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/^[^<>]*$/, { message: 'reason must not contain HTML markup.' })
  reason?: string;
}
