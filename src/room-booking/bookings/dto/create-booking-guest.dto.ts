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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../../common/transformers/strict-boolean.transformer';
import { trimStringTransform } from '../../common/utils/string-transform.util';

export class CreateBookingGuestDto {
  @ApiProperty({ example: 'Asha Sharma' })
  @Transform(trimStringTransform)
  @IsString()
  @MaxLength(120)
  fullName!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 120 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ default: false })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isPrimaryGuest?: boolean;
}
