import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
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

export enum RestaurantSortBy {
  NAME = 'name',
  RATING = 'rating',
  DELIVERY_TIME = 'deliveryTime',
  DELIVERY_FEE = 'deliveryFee',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class RestaurantQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional()
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isPureVeg?: boolean;

  @ApiPropertyOptional()
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;

  @ApiPropertyOptional({
    description:
      'When true, return only open restaurants. False leaves closed restaurants eligible.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  openNow?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
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
    enum: RestaurantSortBy,
    default: RestaurantSortBy.NAME,
  })
  @IsOptional()
  @IsEnum(RestaurantSortBy)
  sortBy: RestaurantSortBy = RestaurantSortBy.NAME;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.ASC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder: SortOrder = SortOrder.ASC;
}
