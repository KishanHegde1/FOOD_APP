import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartItemResponseDto } from './cart-item-response.dto';

export class CartRestaurantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  isOpen!: boolean;
}

export class CartResponseDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  id!: string | null;

  @ApiPropertyOptional({ type: CartRestaurantResponseDto, nullable: true })
  restaurant!: CartRestaurantResponseDto | null;

  @ApiProperty({ type: [CartItemResponseDto] })
  items!: CartItemResponseDto[];

  @ApiProperty()
  totalItems!: number;

  @ApiProperty({ example: 39800 })
  subtotalPaise!: number;

  @ApiProperty()
  hasUnavailableItems!: boolean;

  @ApiPropertyOptional({ nullable: true })
  createdAt?: Date;

  @ApiPropertyOptional({ nullable: true })
  updatedAt?: Date;
}
