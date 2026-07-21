import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RestaurantTableResponseDto } from './restaurant-table-response.dto';

export class TableQrResponseDto {
  @ApiProperty({ type: RestaurantTableResponseDto })
  table!: RestaurantTableResponseDto;

  @ApiProperty({
    description:
      'Raw QR token. This is returned only when creating or regenerating a QR code.',
  })
  qrToken!: string;

  @ApiProperty({
    example:
      'foodapp://dine-in?restaurantId=...&tableId=...&version=1&token=...',
  })
  deepLink!: string;
}

export class TableQrMetadataResponseDto {
  @ApiProperty({ type: RestaurantTableResponseDto })
  table!: RestaurantTableResponseDto;

  @ApiProperty({ example: false })
  rawTokenAvailable!: false;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Tokens are intentionally not recoverable. Regenerate the QR to receive a replacement.',
  })
  message!: string | null;
}
