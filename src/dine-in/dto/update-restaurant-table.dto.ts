import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';
import { trimString } from './dine-in-dto-transformers';

export class UpdateRestaurantTableDto {
  @ApiPropertyOptional({ example: 'Window table', maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  capacity?: number;

  @ApiPropertyOptional({
    description: 'Whether newly scanned QR codes can be used.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
