import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FoodResponseDto } from '../../foods/dto/food-response.dto';
import { DineInSessionResponseDto } from './dine-in-session-response.dto';

export class DineInFoodAvailabilityResponseDto {
  @ApiProperty({ example: true })
  currentlyAvailable!: boolean;

  @ApiPropertyOptional({ nullable: true, example: '12:00 PM' })
  startTime!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '3:00 PM' })
  endTime!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: 'Available daily from 12:00 PM to 3:00 PM',
  })
  message!: string | null;
}

export class DineInScannedMenuItemResponseDto extends FoodResponseDto {
  @ApiProperty({ type: DineInFoodAvailabilityResponseDto })
  availability!: DineInFoodAvailabilityResponseDto;
}

export class DineInScannedMenuCategoryResponseDto {
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

  @ApiProperty({ type: [DineInScannedMenuItemResponseDto] })
  items!: DineInScannedMenuItemResponseDto[];
}

class DineInScanRestaurantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;

  @ApiProperty()
  address!: string;

  @ApiProperty()
  rating!: number;
}

class DineInScanTableDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  tableNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiProperty()
  capacity!: number;
}

export class DineInQrScanResponseDto {
  @ApiProperty({ example: true })
  valid!: true;

  @ApiProperty({ type: DineInScanRestaurantDto })
  restaurant!: DineInScanRestaurantDto;

  @ApiProperty({ type: DineInScanTableDto })
  table!: DineInScanTableDto;

  @ApiPropertyOptional({ type: DineInSessionResponseDto, nullable: true })
  activeSession!: DineInSessionResponseDto | null;

  @ApiProperty({
    type: [DineInScannedMenuCategoryResponseDto],
    description:
      'Active restaurant menu. Time-restricted items remain visible and expose their current availability.',
  })
  categories!: DineInScannedMenuCategoryResponseDto[];

  @ApiProperty({ type: [DineInScannedMenuItemResponseDto] })
  uncategorizedItems!: DineInScannedMenuItemResponseDto[];
}
