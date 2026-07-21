import { ApiProperty } from '@nestjs/swagger';
import { RestaurantResponseDto } from './restaurant-response.dto';

export class PaginatedRestaurantsResponseDto {
  @ApiProperty({ type: [RestaurantResponseDto] })
  items!: RestaurantResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
