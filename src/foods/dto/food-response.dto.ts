import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Food } from '../entities/food.entity';

export class FoodResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  categoryId!: string | null;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty({ example: 19900 })
  pricePaise!: number;

  @ApiPropertyOptional({ example: 24900, nullable: true })
  originalPricePaise!: number | null;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  reviewCount!: number;

  @ApiProperty()
  preparationMinutes!: number;

  @ApiProperty({ description: 'true for vegetarian food.' })
  isVeg!: boolean;

  @ApiProperty()
  isBestseller!: boolean;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  sortOrder!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true })
  categoryName?: string | null;

  @ApiPropertyOptional({ nullable: true })
  restaurantName?: string | null;

  static fromEntity(food: Food, includeNames = false): FoodResponseDto {
    const response: FoodResponseDto = {
      id: food.id,
      restaurantId: food.restaurantId,
      categoryId: food.categoryId,
      name: food.name,
      description: food.description,
      imageUrl: food.imageUrl,
      pricePaise: Number(food.pricePaise),
      originalPricePaise:
        food.originalPricePaise === null
          ? null
          : Number(food.originalPricePaise),
      rating: Number(food.rating),
      reviewCount: Number(food.reviewCount),
      preparationMinutes: Number(food.preparationMinutes),
      isVeg: food.isVeg,
      isBestseller: food.isBestseller,
      isAvailable: food.isAvailable,
      sortOrder: Number(food.sortOrder),
      createdAt: food.createdAt.toISOString(),
      updatedAt: food.updatedAt.toISOString(),
    };

    if (includeNames) {
      response.categoryName = food.category?.name ?? null;
      response.restaurantName = food.restaurant?.name ?? null;
    }

    return response;
  }
}
