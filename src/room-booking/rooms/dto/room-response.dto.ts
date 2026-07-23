import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BedType, RoomType } from '../../common/enums/room-booking.enums';

export class RoomImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  altText!: string | null;

  @ApiProperty()
  isPrimary!: boolean;
}

export class RoomAmenityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  icon!: string | null;
}

export class RoomSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  hotelId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: RoomType })
  roomType!: RoomType;

  @ApiProperty({ enum: BedType })
  bedType!: BedType;

  @ApiProperty()
  maxAdults!: number;

  @ApiProperty()
  maxChildren!: number;

  @ApiProperty()
  basePrice!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  primaryImage!: string | null;

  @ApiProperty({ type: [RoomAmenityResponseDto] })
  amenities!: RoomAmenityResponseDto[];
}

export class RoomDetailResponseDto extends RoomSummaryResponseDto {
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  roomSizeSqft!: number | null;

  @ApiProperty()
  taxPercentage!: number;

  @ApiProperty({ type: Object })
  cancellationPolicy!: Record<string, unknown>;

  @ApiProperty({ type: [RoomImageResponseDto] })
  images!: RoomImageResponseDto[];

  @ApiProperty({ type: Object })
  hotel!: Record<string, unknown>;
}
