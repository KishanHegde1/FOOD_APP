import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimString } from './dine-in-dto-transformers';

export class CloseDineInSessionDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  cancellationReason?: string;
}
