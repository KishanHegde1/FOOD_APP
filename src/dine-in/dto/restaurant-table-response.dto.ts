import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestaurantTable } from '../entities/restaurant-table.entity';

export class RestaurantTableResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  restaurantId!: string;

  @ApiProperty()
  tableNumber!: string;

  @ApiPropertyOptional({ nullable: true })
  displayName!: string | null;

  @ApiProperty()
  capacity!: number;

  @ApiProperty()
  qrTokenVersion!: number;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromEntity(table: RestaurantTable): RestaurantTableResponseDto {
    return {
      id: table.id,
      restaurantId: table.restaurantId,
      tableNumber: table.tableNumber,
      displayName: table.displayName,
      capacity: table.capacity,
      qrTokenVersion: table.qrTokenVersion,
      isActive: table.isActive,
      createdAt: table.createdAt.toISOString(),
      updatedAt: table.updatedAt.toISOString(),
    };
  }
}
