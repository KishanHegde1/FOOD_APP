import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Address, AddressLabel } from '../entities/address.entity';

export class AddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AddressLabel })
  label!: AddressLabel;

  @ApiProperty()
  recipientName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  addressLine!: string;

  @ApiPropertyOptional({ nullable: true })
  locality!: string | null;

  @ApiPropertyOptional({ nullable: true })
  landmark!: string | null;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional({ nullable: true })
  state!: string | null;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  country!: string;

  @ApiPropertyOptional({ nullable: true })
  latitude!: number | null;

  @ApiPropertyOptional({ nullable: true })
  longitude!: number | null;

  @ApiProperty()
  isDefault!: boolean;

  @ApiProperty()
  isActive!: boolean;

  @ApiProperty()
  formattedAddress!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  static fromEntity(address: Address): AddressResponseDto {
    return {
      id: address.id,
      label: address.label,
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine: address.addressLine,
      locality: address.locality,
      landmark: address.landmark,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: address.isDefault,
      isActive: address.isActive,
      formattedAddress: [
        address.addressLine,
        address.locality,
        address.landmark,
        address.city,
        address.state,
        address.postalCode,
        address.country,
      ]
        .filter((part): part is string => Boolean(part))
        .join(', '),
      createdAt: address.createdAt,
      updatedAt: address.updatedAt,
    };
  }
}
