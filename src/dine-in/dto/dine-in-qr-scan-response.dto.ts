import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DineInSessionResponseDto } from './dine-in-session-response.dto';

class DineInScanRestaurantDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  imageUrl!: string | null;
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
}
