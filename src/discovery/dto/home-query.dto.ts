import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { strictBooleanTransform } from '../../common/transformers/strict-boolean.transformer';
import { RestaurantDiscoveryFiltersDto } from './restaurant-discovery-filters.dto';

export class HomeQueryDto extends RestaurantDiscoveryFiltersDto {
  @ApiPropertyOptional({
    description: 'Filter food sections by vegetarian status.',
  })
  @Transform(strictBooleanTransform)
  @IsOptional()
  @IsBoolean()
  isVeg?: boolean;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  restaurantLimit = 10;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 30 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  foodLimit = 10;
}
