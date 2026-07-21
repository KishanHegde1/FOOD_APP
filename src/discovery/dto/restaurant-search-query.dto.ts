import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RestaurantDiscoveryFiltersDto } from './restaurant-discovery-filters.dto';

export enum RestaurantSearchSortBy {
  RELEVANCE = 'relevance',
  RATING = 'rating',
  DELIVERY_TIME = 'deliveryTime',
  DELIVERY_FEE = 'deliveryFee',
  NAME = 'name',
  CREATED_AT = 'createdAt',
  DISTANCE = 'distance',
}

export enum DiscoverySortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

const normalizeWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class RestaurantSearchQueryDto extends RestaurantDiscoveryFiltersDto {
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

  @ApiPropertyOptional({ enum: RestaurantSearchSortBy })
  @IsOptional()
  @IsEnum(RestaurantSearchSortBy)
  sortBy?: RestaurantSearchSortBy;

  @ApiPropertyOptional({ enum: DiscoverySortOrder })
  @IsOptional()
  @IsEnum(DiscoverySortOrder)
  sortOrder?: DiscoverySortOrder;
}
