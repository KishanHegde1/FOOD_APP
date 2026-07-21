import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DiscoveryRestaurantCardDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bannerUrl!: string | null;

  @ApiProperty()
  city!: string;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  reviewCount!: number;

  @ApiProperty()
  deliveryTimeMinutes!: number;

  @ApiProperty()
  deliveryFeePaise!: number;

  @ApiProperty()
  minimumOrderPaise!: number;

  @ApiProperty()
  isPureVeg!: boolean;

  @ApiProperty()
  isOpen!: boolean;

  @ApiPropertyOptional({ nullable: true })
  distanceKm?: number | null;
}

export class DiscoveryFoodCardDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty()
  restaurantName!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  categoryId!: string | null;

  @ApiPropertyOptional({ nullable: true })
  categoryName!: string | null;

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

  @ApiProperty()
  isVeg!: boolean;

  @ApiProperty()
  isBestseller!: boolean;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  restaurantIsOpen!: boolean;

  @ApiProperty()
  restaurantIsPureVeg!: boolean;
}

export class HomeMetadataDto {
  @ApiPropertyOptional({ nullable: true })
  city!: string | null;

  @ApiProperty()
  pureVegOnly!: boolean;
}

export class HomeResponseDto {
  @ApiProperty({ type: [DiscoveryRestaurantCardDto] })
  popularRestaurants!: DiscoveryRestaurantCardDto[];

  @ApiProperty({ type: [DiscoveryRestaurantCardDto] })
  recommendedRestaurants!: DiscoveryRestaurantCardDto[];

  @ApiProperty({ type: [DiscoveryFoodCardDto] })
  bestsellerFoods!: DiscoveryFoodCardDto[];

  @ApiProperty({ type: [DiscoveryFoodCardDto] })
  recommendedFoods!: DiscoveryFoodCardDto[];

  @ApiProperty({ type: HomeMetadataDto })
  metadata!: HomeMetadataDto;
}
