import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';
import { DiscoverySortOrder } from './restaurant-search-query.dto';

export enum FoodSearchSortBy {
  RELEVANCE = 'relevance',
  RATING = 'rating',
  PRICE = 'price',
  PREPARATION_TIME = 'preparationTime',
  NAME = 'name',
  CREATED_AT = 'createdAt',
}

const normalizeWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class FoodSearchQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 100 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q?: string;

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

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(normalizeWhitespace)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  restaurantId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional()
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @ApiPropertyOptional()
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isBestseller?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(5)
  minimumRating?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  minimumPricePaise?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  maximumPricePaise?: number;

  @ApiPropertyOptional({ enum: FoodSearchSortBy })
  @IsOptional()
  @IsEnum(FoodSearchSortBy)
  sortBy?: FoodSearchSortBy;

  @ApiPropertyOptional({ enum: DiscoverySortOrder })
  @IsOptional()
  @IsEnum(DiscoverySortOrder)
  sortOrder?: DiscoverySortOrder;
}
