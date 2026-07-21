import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  foodItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  isVeg!: boolean;

  @ApiProperty()
  isAvailable!: boolean;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ example: 19900 })
  unitPricePaise!: number;

  @ApiPropertyOptional({ nullable: true, example: 24900 })
  originalPricePaise!: number | null;

  @ApiProperty({ example: 39800 })
  itemSubtotalPaise!: number;
}
