import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Restaurant } from '../entities/restaurant.entity';

export class RestaurantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional({ nullable: true })
  slug!: string | null;

  @ApiPropertyOptional({ nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  phone!: string | null;

  @ApiPropertyOptional({ nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  logoUrl!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bannerUrl!: string | null;

  @ApiProperty()
  addressLine!: string;

  @ApiPropertyOptional({ nullable: true })
  locality!: string | null;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  state!: string | null;

  @ApiPropertyOptional({ nullable: true })
  postalCode!: string | null;

  @ApiProperty()
  country!: string;

  @ApiPropertyOptional({ nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude!: number | null;

  @ApiProperty()
  rating!: number;

  @ApiProperty()
  reviewCount!: number;

  @ApiProperty()
  averageDeliveryMinutes!: number;

  @ApiProperty()
  deliveryFeePaise!: number;

  @ApiProperty()
  minimumOrderPaise!: number;

  @ApiProperty()
  serviceRadiusKm!: number;

  @ApiProperty()
  isOpen!: boolean;

  @ApiProperty()
  isPureVeg!: boolean;

  @ApiPropertyOptional({ nullable: true })
  openingTime!: string | null;

  @ApiPropertyOptional({ nullable: true })
  closingTime!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static fromEntity(restaurant: Restaurant): RestaurantResponseDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      description: restaurant.description,
      phone: restaurant.phone,
      email: restaurant.email,
      logoUrl: restaurant.logoUrl,
      bannerUrl: restaurant.bannerUrl,
      addressLine: restaurant.addressLine,
      locality: restaurant.locality,
      city: restaurant.city,
      state: restaurant.state,
      postalCode: restaurant.postalCode,
      country: restaurant.country,
      latitude: toNumberOrNull(restaurant.latitude),
      longitude: toNumberOrNull(restaurant.longitude),
      rating: Number(restaurant.rating),
      reviewCount: Number(restaurant.reviewCount),
      averageDeliveryMinutes: Number(restaurant.averageDeliveryMinutes),
      deliveryFeePaise: Number(restaurant.deliveryFeePaise),
      minimumOrderPaise: Number(restaurant.minimumOrderPaise),
      serviceRadiusKm: Number(restaurant.serviceRadiusKm),
      isOpen: restaurant.isOpen,
      isPureVeg: restaurant.isPureVeg,
      openingTime: restaurant.openingTime,
      closingTime: restaurant.closingTime,
      createdAt: restaurant.createdAt.toISOString(),
      updatedAt: restaurant.updatedAt.toISOString(),
    };
  }
}

function toNumberOrNull(value: number | null): number | null {
  return value === null ? null : Number(value);
}
