import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AddressLabel } from '../../addresses/entities/address.entity';
import { CheckoutBlockerCode } from '../interfaces/checkout-types';

export class CheckoutRestaurantResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  isOpen!: boolean;
}

export class CheckoutAddressResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: AddressLabel })
  label!: AddressLabel;

  @ApiProperty()
  recipientName!: string;

  @ApiProperty()
  phone!: string;

  @ApiProperty()
  formattedAddress!: string;
}

export class CheckoutItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  cartItemId!: string;

  @ApiProperty({ format: 'uuid' })
  foodItemId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  quantity!: number;

  @ApiProperty({ example: 19900 })
  unitPricePaise!: number;

  @ApiProperty({ example: 39800 })
  itemSubtotalPaise!: number;

  @ApiProperty()
  isAvailable!: boolean;
}

export class CheckoutPricingResponseDto {
  @ApiProperty({ example: 39800 })
  subtotalPaise!: number;

  @ApiProperty({ example: 4000 })
  deliveryFeePaise!: number;

  @ApiProperty({ example: 0 })
  taxPaise!: number;

  @ApiProperty({ example: 0 })
  packagingFeePaise!: number;

  @ApiProperty({ example: 0 })
  discountPaise!: number;

  @ApiProperty({ example: 43800 })
  totalPaise!: number;
}

export class CheckoutBlockerResponseDto {
  @ApiProperty({ enum: CheckoutBlockerCode })
  code!: CheckoutBlockerCode;

  @ApiProperty()
  message!: string;
}

export class CheckoutPreviewResponseDto {
  @ApiProperty({ format: 'uuid' })
  cartId!: string;

  @ApiProperty({ type: CheckoutRestaurantResponseDto })
  restaurant!: CheckoutRestaurantResponseDto;

  @ApiProperty({ type: CheckoutAddressResponseDto })
  address!: CheckoutAddressResponseDto;

  @ApiProperty({ type: [CheckoutItemResponseDto] })
  items!: CheckoutItemResponseDto[];

  @ApiProperty({ type: CheckoutPricingResponseDto })
  pricing!: CheckoutPricingResponseDto;

  @ApiProperty({ example: 10000 })
  minimumOrderPaise!: number;

  @ApiProperty()
  minimumOrderSatisfied!: boolean;

  @ApiProperty()
  canPlaceOrder!: boolean;

  @ApiProperty({ type: [CheckoutBlockerResponseDto] })
  blockers!: CheckoutBlockerResponseDto[];

  @ApiPropertyOptional({ nullable: true })
  distanceKm?: number | null;
}
