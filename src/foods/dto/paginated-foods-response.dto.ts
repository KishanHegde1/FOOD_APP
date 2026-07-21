import { ApiProperty } from '@nestjs/swagger';
import { FoodResponseDto } from './food-response.dto';

export class PaginatedFoodsResponseDto {
  @ApiProperty({ type: [FoodResponseDto] })
  items!: FoodResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}
