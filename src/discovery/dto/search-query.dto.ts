import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';
import { RestaurantDiscoveryFiltersDto } from './restaurant-discovery-filters.dto';

const normalizeWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value;

export class SearchQueryDto extends RestaurantDiscoveryFiltersDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @Transform(normalizeWhitespace)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  q!: string;

  @ApiProperty({ default: 10, minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  restaurantLimit = 10;

  @ApiProperty({ default: 10, minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  foodLimit = 10;

  @ApiProperty({ required: false })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;
}
