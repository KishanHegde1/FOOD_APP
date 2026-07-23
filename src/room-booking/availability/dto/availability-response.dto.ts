import { ApiProperty } from '@nestjs/swagger';

export class NightlyAvailabilityResponseDto {
  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty()
  availableRooms!: number;

  @ApiProperty()
  pricePerRoom!: number;

  @ApiProperty()
  lineTotal!: number;
}

export class RoomAvailabilityResponseDto {
  @ApiProperty()
  available!: boolean;

  @ApiProperty()
  requestedRoomCount!: number;

  @ApiProperty()
  minimumAvailableRooms!: number;

  @ApiProperty()
  numberOfNights!: number;

  @ApiProperty({ type: [NightlyAvailabilityResponseDto] })
  nightlyBreakdown!: NightlyAvailabilityResponseDto[];

  @ApiProperty()
  subtotal!: number;

  @ApiProperty()
  estimatedTax!: number;

  @ApiProperty()
  estimatedTotal!: number;

  @ApiProperty()
  currency!: string;
}
