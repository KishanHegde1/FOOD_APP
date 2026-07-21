import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { AddressResponseDto } from '../addresses/dto/address-response.dto';
import { Address } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CartRepository } from '../cart/cart.repository';
import { CartItem } from '../cart/entities/cart-item.entity';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CheckoutPreviewDto } from './dto/checkout-preview.dto';
import {
  CheckoutAddressResponseDto,
  CheckoutItemResponseDto,
  CheckoutPreviewResponseDto,
  CheckoutRestaurantResponseDto,
} from './dto/checkout-preview-response.dto';
import { CheckoutRepository } from './checkout.repository';
import {
  CheckoutBlocker,
  CheckoutBlockerCode,
} from './interfaces/checkout-types';

@Injectable()
export class CheckoutService {
  constructor(
    private readonly cartRepository: CartRepository,
    private readonly addressesService: AddressesService,
    private readonly checkoutRepository: CheckoutRepository,
  ) {}

  async preview(
    user: User,
    dto: CheckoutPreviewDto,
  ): Promise<CheckoutPreviewResponseDto> {
    return this.safely(async () => {
      this.ensureCustomer(user);
      const address = await this.addressesService.findActiveAddressForUser(
        user,
        dto.deliveryAddressId,
      );
      const cart = await this.cartRepository.findCartWithItemsByUserId(user.id);
      if (!cart || !cart.items || cart.items.length === 0) {
        throw new BadRequestException({
          code: CheckoutBlockerCode.CART_EMPTY,
          message: 'Your cart is empty.',
        });
      }

      const restaurant = cart.restaurant ?? cart.items[0].food.restaurant;
      const blockers: CheckoutBlocker[] = [];
      this.validateRestaurant(restaurant, blockers);
      this.validateCartRestaurantConsistency(
        cart.restaurantId,
        cart.items,
        blockers,
      );

      const items = cart.items.map((item) =>
        this.toCheckoutItem(item, blockers),
      );
      const subtotalPaise = items.reduce(
        (total, item) => total + item.itemSubtotalPaise,
        0,
      );
      const minimumOrderPaise = restaurant.minimumOrderPaise;
      const minimumOrderSatisfied = subtotalPaise >= minimumOrderPaise;
      if (!minimumOrderSatisfied) {
        this.addBlocker(blockers, {
          code: CheckoutBlockerCode.MINIMUM_ORDER_NOT_MET,
          message: `Minimum order value is ${minimumOrderPaise} paise.`,
        });
      }

      const distanceKm = await this.validateServiceability(
        restaurant,
        address,
        blockers,
      );
      const deliveryFeePaise = restaurant.deliveryFeePaise;
      const taxPaise = 0;
      const packagingFeePaise = 0;
      const discountPaise = 0;

      await this.cartRepository.updateCartItemPrices(cart.items);

      return {
        cartId: cart.id,
        restaurant: this.toRestaurant(restaurant),
        address: this.toAddress(address),
        items,
        pricing: {
          subtotalPaise,
          deliveryFeePaise,
          taxPaise,
          packagingFeePaise,
          discountPaise,
          totalPaise:
            subtotalPaise +
            deliveryFeePaise +
            taxPaise +
            packagingFeePaise -
            discountPaise,
        },
        minimumOrderPaise,
        minimumOrderSatisfied,
        canPlaceOrder: blockers.every(
          (blocker) => blocker.code === CheckoutBlockerCode.PRICE_CHANGED,
        ),
        blockers,
        ...(distanceKm === null ? {} : { distanceKm }),
      };
    });
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException('Only customers can preview checkout.');
    }
  }

  private validateRestaurant(
    restaurant: Restaurant,
    blockers: CheckoutBlocker[],
  ): void {
    if (
      !restaurant.isActive ||
      restaurant.status !== RestaurantStatus.APPROVED
    ) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.RESTAURANT_UNAVAILABLE,
        message: 'The restaurant is unavailable.',
      });
    }
    if (!restaurant.isOpen) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.RESTAURANT_CLOSED,
        message: 'The restaurant is currently closed.',
      });
    }
  }

  private validateCartRestaurantConsistency(
    cartRestaurantId: string | null,
    items: CartItem[],
    blockers: CheckoutBlocker[],
  ): void {
    if (
      !cartRestaurantId ||
      items.some((item) => item.food.restaurantId !== cartRestaurantId)
    ) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.CART_RESTAURANT_MISMATCH,
        message: 'Cart items must belong to the same restaurant.',
      });
    }
  }

  private toCheckoutItem(
    item: CartItem,
    blockers: CheckoutBlocker[],
  ): CheckoutItemResponseDto {
    const food = item.food;
    if (item.quantity < 1 || item.quantity > 20) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.INVALID_ITEM_QUANTITY,
        message: `${food.name} has an invalid quantity.`,
      });
    }
    if (!food.isActive) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.ITEM_INACTIVE,
        message: `${food.name} is inactive.`,
      });
    }
    if (!food.isAvailable) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.ITEM_UNAVAILABLE,
        message: `${food.name} is unavailable.`,
      });
    }
    if (item.unitPricePaise !== food.pricePaise) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.PRICE_CHANGED,
        message: `${food.name} price has been updated.`,
      });
    }

    return {
      cartItemId: item.id,
      foodItemId: food.id,
      name: food.name,
      quantity: item.quantity,
      unitPricePaise: food.pricePaise,
      itemSubtotalPaise: food.pricePaise * item.quantity,
      isAvailable: food.isActive && food.isAvailable,
    };
  }

  private async validateServiceability(
    restaurant: Restaurant,
    address: Address,
    blockers: CheckoutBlocker[],
  ): Promise<number | null> {
    const serviceRadiusKm = Number(restaurant.serviceRadiusKm);
    if (!Number.isFinite(serviceRadiusKm) || serviceRadiusKm <= 0) {
      return null;
    }

    const distanceKm = await this.checkoutRepository.calculateDistanceKm(
      restaurant,
      address,
    );
    if (distanceKm !== null && distanceKm > serviceRadiusKm) {
      this.addBlocker(blockers, {
        code: CheckoutBlockerCode.ADDRESS_NOT_SERVICEABLE,
        message: 'This address is outside the restaurant delivery area.',
      });
    }
    return distanceKm;
  }

  private addBlocker(
    blockers: CheckoutBlocker[],
    blocker: CheckoutBlocker,
  ): void {
    if (!blockers.some((existing) => existing.code === blocker.code)) {
      blockers.push(blocker);
    }
  }

  private toRestaurant(restaurant: Restaurant): CheckoutRestaurantResponseDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      isOpen: restaurant.isOpen,
    };
  }

  private toAddress(address: Address): CheckoutAddressResponseDto {
    const response = AddressResponseDto.fromEntity(address);
    return {
      id: response.id,
      label: response.label,
      recipientName: response.recipientName,
      phone: response.phone,
      formattedAddress: response.formattedAddress,
    };
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to preview checkout.');
    }
  }
}
