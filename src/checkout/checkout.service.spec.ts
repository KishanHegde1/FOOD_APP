import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Address, AddressLabel } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CartRepository } from '../cart/cart.repository';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart } from '../cart/entities/cart.entity';
import { Food } from '../foods/entities/food.entity';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CheckoutRepository } from './checkout.repository';
import { CheckoutService } from './checkout.service';
import { CheckoutBlockerCode } from './interfaces/checkout-types';

describe('CheckoutService', () => {
  let service: CheckoutService;
  let cartRepository: {
    findCartWithItemsByUserId: jest.Mock;
    updateCartItemPrices: jest.Mock;
  };
  let addressesService: { findActiveAddressForUser: jest.Mock };
  let checkoutRepository: { calculateDistanceKm: jest.Mock };

  beforeEach(() => {
    cartRepository = {
      findCartWithItemsByUserId: jest.fn(),
      updateCartItemPrices: jest.fn().mockResolvedValue(undefined),
    };
    addressesService = { findActiveAddressForUser: jest.fn() };
    checkoutRepository = {
      calculateDistanceKm: jest.fn().mockResolvedValue(null),
    };
    service = new CheckoutService(
      cartRepository as unknown as CartRepository,
      addressesService as unknown as AddressesService,
      checkoutRepository as unknown as CheckoutRepository,
    );
    addressesService.findActiveAddressForUser.mockResolvedValue(address());
  });

  it('rejects an empty cart without creating an order', async () => {
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(null);

    await expect(
      service.preview(customer(), { deliveryAddressId: ADDRESS_ID }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cartRepository.updateCartItemPrices).not.toHaveBeenCalled();
  });

  it('rejects a non-customer before reading the cart or address', async () => {
    await expect(
      service.preview(customer({ role: UserRole.ADMIN }), {
        deliveryAddressId: ADDRESS_ID,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cartRepository.findCartWithItemsByUserId).not.toHaveBeenCalled();
    expect(addressesService.findActiveAddressForUser).not.toHaveBeenCalled();
  });

  it('uses current food prices and calculates delivery-inclusive trusted totals', async () => {
    const item = cartItem({ quantity: 2, unitPricePaise: 10000 });
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(
      cart({ items: [item] }),
    );

    await expect(
      service.preview(customer(), { deliveryAddressId: ADDRESS_ID }),
    ).resolves.toMatchObject({
      pricing: {
        subtotalPaise: 39800,
        deliveryFeePaise: 4000,
        taxPaise: 0,
        packagingFeePaise: 0,
        discountPaise: 0,
        totalPaise: 43800,
      },
      minimumOrderSatisfied: true,
      canPlaceOrder: true,
      blockers: [{ code: CheckoutBlockerCode.PRICE_CHANGED }],
    });
    expect(cartRepository.updateCartItemPrices).toHaveBeenCalledWith([item]);
  });

  it('uses only an address belonging to the authenticated user', async () => {
    const missingAddress = new NotFoundException('Address not found.');
    addressesService.findActiveAddressForUser.mockRejectedValue(missingAddress);

    await expect(
      service.preview(customer(), { deliveryAddressId: OTHER_ADDRESS_ID }),
    ).rejects.toBe(missingAddress);
    expect(addressesService.findActiveAddressForUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: USER_ID }),
      OTHER_ADDRESS_ID,
    );
  });

  it.each([
    [
      'an unavailable food item',
      () => cart({ items: [cartItem({ food: food({ isAvailable: false }) })] }),
      CheckoutBlockerCode.ITEM_UNAVAILABLE,
    ],
    [
      'an inactive food item',
      () => cart({ items: [cartItem({ food: food({ isActive: false }) })] }),
      CheckoutBlockerCode.ITEM_INACTIVE,
    ],
    [
      'a closed restaurant',
      () =>
        cart({
          restaurant: restaurant({ isOpen: false }),
          items: [
            cartItem({
              food: food({ restaurant: restaurant({ isOpen: false }) }),
            }),
          ],
        }),
      CheckoutBlockerCode.RESTAURANT_CLOSED,
    ],
    [
      'an unapproved restaurant',
      () =>
        cart({
          restaurant: restaurant({ status: RestaurantStatus.PENDING }),
          items: [
            cartItem({
              food: food({
                restaurant: restaurant({ status: RestaurantStatus.PENDING }),
              }),
            }),
          ],
        }),
      CheckoutBlockerCode.RESTAURANT_UNAVAILABLE,
    ],
  ])('returns a blocker for %s', async (_, createCart, expectedCode) => {
    const persistedCart = createCart();
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(persistedCart);

    const preview = await service.preview(customer(), {
      deliveryAddressId: ADDRESS_ID,
    });
    expect(preview.canPlaceOrder).toBe(false);
    expect(preview.blockers).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: expectedCode })]),
    );
  });

  it('enforces the stored minimum order value', async () => {
    const lowValueRestaurant = restaurant({ minimumOrderPaise: 25000 });
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(
      cart({
        restaurant: lowValueRestaurant,
        items: [cartItem({ food: food({ restaurant: lowValueRestaurant }) })],
      }),
    );

    const preview = await service.preview(customer(), {
      deliveryAddressId: ADDRESS_ID,
    });
    expect(preview.minimumOrderSatisfied).toBe(false);
    expect(preview.canPlaceOrder).toBe(false);
    expect(preview.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CheckoutBlockerCode.MINIMUM_ORDER_NOT_MET,
        }),
      ]),
    );
  });

  it('blocks legacy cart items with an invalid quantity', async () => {
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(
      cart({ items: [cartItem({ quantity: 21 })] }),
    );

    const preview = await service.preview(customer(), {
      deliveryAddressId: ADDRESS_ID,
    });

    expect(preview.canPlaceOrder).toBe(false);
    expect(preview.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CheckoutBlockerCode.INVALID_ITEM_QUANTITY,
        }),
      ]),
    );
  });

  it('blocks an address outside the configured restaurant service radius', async () => {
    const persistedCart = cart({ items: [cartItem()] });
    cartRepository.findCartWithItemsByUserId.mockResolvedValue(persistedCart);
    checkoutRepository.calculateDistanceKm.mockResolvedValue(6);

    const preview = await service.preview(customer(), {
      deliveryAddressId: ADDRESS_ID,
    });
    expect(preview.distanceKm).toBe(6);
    expect(preview.canPlaceOrder).toBe(false);
    expect(preview.blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: CheckoutBlockerCode.ADDRESS_NOT_SERVICEABLE,
        }),
      ]),
    );
  });
});

const USER_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_ADDRESS_ID = '20000000-0000-4000-8000-000000000002';
const RESTAURANT_ID = '30000000-0000-4000-8000-000000000001';
const CART_ID = '40000000-0000-4000-8000-000000000001';
const CART_ITEM_ID = '50000000-0000-4000-8000-000000000001';
const FOOD_ID = '60000000-0000-4000-8000-000000000001';

function customer(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    firebaseUid: 'firebase-customer',
    phone: '+919876543210',
    name: 'Customer',
    email: null,
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: RESTAURANT_ID,
    ownerId: '70000000-0000-4000-8000-000000000001',
    owner: customer({ id: '70000000-0000-4000-8000-000000000001' }),
    name: 'Pizza Palace',
    slug: 'pizza-palace',
    description: null,
    phone: null,
    email: null,
    logoUrl: null,
    bannerUrl: null,
    addressLine: '12 Main Road',
    locality: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    rating: 4.5,
    reviewCount: 12,
    averageDeliveryMinutes: 30,
    deliveryFeePaise: 4000,
    minimumOrderPaise: 10000,
    serviceRadiusKm: 5,
    isOpen: true,
    isActive: true,
    isPureVeg: false,
    status: RestaurantStatus.APPROVED,
    openingTime: null,
    closingTime: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: FOOD_ID,
    restaurantId: RESTAURANT_ID,
    restaurant: restaurant(),
    categoryId: null,
    category: null,
    name: 'Margherita Pizza',
    description: 'Cheese pizza',
    imageUrl: null,
    pricePaise: 19900,
    originalPricePaise: 24900,
    rating: 4.5,
    reviewCount: 10,
    preparationMinutes: 20,
    isVeg: true,
    isBestseller: true,
    isAvailable: true,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    id: CART_ID,
    userId: USER_ID,
    user: customer(),
    restaurantId: RESTAURANT_ID,
    restaurant: restaurant(),
    couponCode: null,
    items: [],
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: CART_ITEM_ID,
    cartId: CART_ID,
    cart: cart(),
    foodItemId: FOOD_ID,
    food: food(),
    quantity: 1,
    unitPricePaise: 19900,
    instructions: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: ADDRESS_ID,
    userId: USER_ID,
    user: customer(),
    label: AddressLabel.HOME,
    recipientName: 'Customer',
    phone: '+919876543210',
    addressLine: '12 Main Road',
    locality: 'Indiranagar',
    landmark: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    latitude: 12.98,
    longitude: 77.6,
    location: null,
    isDefault: true,
    isActive: true,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}
