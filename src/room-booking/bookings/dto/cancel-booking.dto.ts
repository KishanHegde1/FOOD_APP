import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { trimStringTransform } from '../../common/utils/string-transform.util';

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'Travel plan changed', maxLength: 500 })
  @IsOptional()
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(500)
  reason?: string;
}
