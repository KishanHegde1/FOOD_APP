import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HotelType } from '../../common/enums/room-booking.enums';
import { RoomSummaryResponseDto } from '../../rooms/dto/room-response.dto';

export class HotelAmenityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  icon!: string | null;
}

export class HotelImageResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  imageUrl!: string;

  @ApiPropertyOptional({ nullable: true })
  altText!: string | null;

  @ApiProperty()
  isPrimary!: boolean;

  @ApiProperty()
  sortOrder!: number;
}

export class HotelSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: HotelType })
  hotelType!: HotelType;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  state!: string | null;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  starRating!: number;

  @ApiProperty()
  averageRating!: number;

  @ApiProperty()
  reviewCount!: number;

  @ApiProperty()
  startingPrice!: number;

  @ApiProperty()
  currency!: string;

  @ApiPropertyOptional({ nullable: true })
  primaryImage!: string | null;

  @ApiProperty({ type: [HotelAmenityResponseDto] })
  amenities!: HotelAmenityResponseDto[];
}

export class HotelDetailResponseDto extends HotelSummaryResponseDto {
  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiProperty()
  addressLine!: string;

  @ApiPropertyOptional({ nullable: true })
  locality!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode!: string | null;

  @ApiPropertyOptional({ nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude!: number | null;

  @ApiPropertyOptional({ nullable: true })
  checkInTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  checkOutTime!: string | null;

  @ApiProperty({ type: Object })
  policies!: Record<string, unknown>;

  @ApiProperty({ type: [HotelImageResponseDto] })
  images!: HotelImageResponseDto[];

  @ApiProperty({ type: [RoomSummaryResponseDto] })
  rooms!: RoomSummaryResponseDto[];
}

export class PaginatedHotelsResponseDto {
  @ApiProperty({ type: [HotelSummaryResponseDto] })
  items!: HotelSummaryResponseDto[];

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PopularDestinationResponseDto {
  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  state!: string | null;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  activeHotelCount!: number;

  @ApiPropertyOptional({ nullable: true })
  primaryImage!: string | null;
}
