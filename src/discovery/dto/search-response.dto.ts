import { ApiProperty } from '@nestjs/swagger';
import {
  DiscoveryFoodCardDto,
  DiscoveryRestaurantCardDto,
} from './home-response.dto';

export class PaginatedRestaurantSearchResponseDto {
  @ApiProperty({ type: [DiscoveryRestaurantCardDto] })
  items!: DiscoveryRestaurantCardDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PaginatedFoodSearchResponseDto {
  @ApiProperty({ type: [DiscoveryFoodCardDto] })
  items!: DiscoveryFoodCardDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class CombinedSearchMetadataDto {
  @ApiProperty()
  restaurantCount!: number;

  @ApiProperty()
  foodCount!: number;
}

export class SearchResponseDto {
  @ApiProperty()
  query!: string;

  @ApiProperty({ type: [DiscoveryRestaurantCardDto] })
  restaurants!: DiscoveryRestaurantCardDto[];

  @ApiProperty({ type: [DiscoveryFoodCardDto] })
  foods!: DiscoveryFoodCardDto[];

  @ApiProperty({ type: CombinedSearchMetadataDto })
  metadata!: CombinedSearchMetadataDto;
}
