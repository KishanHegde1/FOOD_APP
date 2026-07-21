import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class RejectDineInCashPaymentDto {
  @ApiProperty({ maxLength: 500, example: 'Cash was not received.' })
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @Matches(/^[^<>]*$/, { message: 'reason must not contain HTML markup.' })
  reason!: string;
}
