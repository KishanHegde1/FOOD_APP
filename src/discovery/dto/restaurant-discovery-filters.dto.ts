import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class RestaurantDiscoveryFiltersDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ minimum: -90, maximum: 90 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ minimum: -180, maximum: 180 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ minimum: 0.1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @IsPositive()
  @Max(100)
  radiusKm?: number;

  @ApiPropertyOptional({
    description:
      'Omit for all eligible restaurants; true for pure-veg only; false for mixed restaurants only.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isPureVeg?: boolean;

  @ApiPropertyOptional({
    description: 'When true, return only open restaurants.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(5)
  minimumRating?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 300 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  maximumDeliveryMinutes?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maximumDeliveryFeePaise?: number;
}
