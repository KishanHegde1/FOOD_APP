import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodResponseDto } from '../../foods/dto/food-response.dto';

export class DineInMenuCategoryResponseDto {
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
}

export class DineInMenuResponseDto {
  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty({ type: [DineInMenuCategoryResponseDto] })
  categories!: DineInMenuCategoryResponseDto[];

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
