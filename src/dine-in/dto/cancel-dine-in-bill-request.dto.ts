import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class CancelDineInBillRequestDto {
  @ApiPropertyOptional({
    maxLength: 500,
    example: 'Customer would like to add another item.',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^[^<>]*$/, { message: 'reason must not contain HTML markup.' })
  reason?: string;
}
