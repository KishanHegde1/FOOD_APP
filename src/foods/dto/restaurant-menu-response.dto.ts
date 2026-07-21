import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodResponseDto } from './food-response.dto';

export class RestaurantMenuCategoryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ type: [FoodResponseDto] })
  items!: FoodResponseDto[];
}

export class RestaurantMenuResponseDto {
  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty({ type: [RestaurantMenuCategoryResponseDto] })
  categories!: RestaurantMenuCategoryResponseDto[];

  @ApiProperty({ type: [FoodResponseDto] })
  uncategorizedItems!: FoodResponseDto[];
}
