import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Food } from '../foods/entities/food.entity';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CartRepository } from './cart.repository';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { CartItem } from './entities/cart-item.entity';
import { Cart } from './entities/cart.entity';
import { EntityManager } from 'typeorm';

describe('CartService', () => {
  let service: CartService;
  let repository: {
    countCartItems: jest.Mock;
    createCart: jest.Mock;
    createCartItem: jest.Mock;
    deleteAllCartItems: jest.Mock;
    deleteCartItem: jest.Mock;
    findCartItemByFoodId: jest.Mock;
    findCartItemByIdForUser: jest.Mock;
    findCartWithItemsByUserId: jest.Mock;
    findFoodByIdWithRestaurant: jest.Mock;
    saveCart: jest.Mock;
    saveCartItem: jest.Mock;
    transaction: jest.Mock;
    updateCartItemPrices: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      countCartItems: jest.fn(),
      createCart: jest.fn((data: Partial<Cart>) => cart(data)),
      createCartItem: jest.fn((data: Partial<CartItem>) => cartItem(data)),
      deleteAllCartItems: jest.fn(),
      deleteCartItem: jest.fn(),
      findCartItemByFoodId: jest.fn(),
      findCartItemByIdForUser: jest.fn(),
      findCartWithItemsByUserId: jest.fn(),
      findFoodByIdWithRestaurant: jest.fn(),
      saveCart: jest.fn((entity: Cart) => Promise.resolve(entity)),
      saveCartItem: jest.fn((entity: CartItem) => Promise.resolve(entity)),
      transaction: jest.fn(
        (
          operation: (manager: EntityManager) => Promise<unknown>,
        ): Promise<unknown> => operation({} as EntityManager),
      ),
      updateCartItemPrices: jest.fn().mockResolvedValue(undefined),
    };
    service = new CartService(repository as unknown as CartRepository);
  });

  it('returns an empty cart when the customer has no persisted cart', async () => {
    repository.findCartWithItemsByUserId.mockResolvedValue(null);

    await expect(service.getCurrentCart(customer())).resolves.toEqual({
      id: null,
      restaurant: null,
      items: [],
      totalItems: 0,
      subtotalPaise: 0,
      hasUnavailableItems: false,
    });
  });

  it('uses current food prices for cart totals and refreshes snapshots', async () => {
    const item = cartItem({ quantity: 2, unitPricePaise: 10000 });
    repository.findCartWithItemsByUserId.mockResolvedValue(
      cart({ items: [item] }),
    );

    await expect(service.getCurrentCart(customer())).resolves.toMatchObject({
      totalItems: 2,
      subtotalPaise: 39800,
      items: [{ unitPricePaise: 19900, itemSubtotalPaise: 39800 }],
    });
    expect(repository.updateCartItemPrices).toHaveBeenCalledWith([item]);
  });

  it('adds the first trusted food item and ignores any client price fields', async () => {
    const selectedFood = food();
    const persistedCart = cart({
      items: [cartItem({ food: selectedFood, unitPricePaise: 19900 })],
    });
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);
    repository.findCartWithItemsByUserId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(persistedCart);
    repository.saveCart.mockImplementation((entity: Cart) =>
      Promise.resolve({ ...entity, id: CART_ID }),
    );

    await service.addItem(
      customer(),
      Object.assign(new AddCartItemDto(), {
        foodItemId: selectedFood.id,
        quantity: 2,
      }),
    );

    expect(repository.createCart).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, restaurantId: RESTAURANT_ID }),
      expect.anything(),
    );
    expect(repository.createCartItem).toHaveBeenCalledWith(
      expect.objectContaining({
        foodItemId: selectedFood.id,
        quantity: 2,
        unitPricePaise: selectedFood.pricePaise,
      }),
      expect.anything(),
    );
  });

  it('increases an existing item while enforcing the maximum quantity', async () => {
    const selectedFood = food();
    const existing = cartItem({ quantity: 19, food: selectedFood });
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);
    repository.findCartWithItemsByUserId
      .mockResolvedValueOnce(cart())
      .mockResolvedValueOnce(cart({ items: [existing] }));
    repository.findCartItemByFoodId.mockResolvedValue(existing);

    await service.addItem(
      customer(),
      Object.assign(new AddCartItemDto(), {
        foodItemId: selectedFood.id,
        quantity: 1,
      }),
    );
    expect(existing.quantity).toBe(20);
    expect(repository.saveCartItem).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 20, unitPricePaise: 19900 }),
      expect.anything(),
    );
  });

  it('rejects additions that would exceed the maximum quantity', async () => {
    const selectedFood = food();
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);
    repository.findCartWithItemsByUserId.mockResolvedValue(cart());
    repository.findCartItemByFoodId.mockResolvedValue(
      cartItem({ quantity: 20, food: selectedFood }),
    );

    await expect(
      service.addItem(
        customer(),
        Object.assign(new AddCartItemDto(), {
          foodItemId: selectedFood.id,
          quantity: 1,
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('returns a safe conflict for a different restaurant unless replacement is confirmed', async () => {
    const selectedFood = food({
      restaurantId: OTHER_RESTAURANT_ID,
      restaurant: restaurant({ id: OTHER_RESTAURANT_ID, name: 'Other Food' }),
    });
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);
    repository.findCartWithItemsByUserId.mockResolvedValue(cart());

    await expect(
      service.addItem(
        customer(),
        Object.assign(new AddCartItemDto(), { foodItemId: selectedFood.id }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.deleteAllCartItems).not.toHaveBeenCalled();
  });

  it('transactionally replaces a cart when replaceCart is true', async () => {
    const selectedFood = food({
      restaurantId: OTHER_RESTAURANT_ID,
      restaurant: restaurant({ id: OTHER_RESTAURANT_ID, name: 'Other Food' }),
    });
    const existingCart = cart();
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);
    repository.findCartWithItemsByUserId
      .mockResolvedValueOnce(existingCart)
      .mockResolvedValueOnce(
        cart({
          restaurantId: OTHER_RESTAURANT_ID,
          restaurant: selectedFood.restaurant,
          items: [
            cartItem({ food: selectedFood, foodItemId: selectedFood.id }),
          ],
        }),
      );

    await service.addItem(
      customer(),
      Object.assign(new AddCartItemDto(), {
        foodItemId: selectedFood.id,
        replaceCart: true,
      }),
    );

    expect(repository.deleteAllCartItems).toHaveBeenCalledWith(
      existingCart.id,
      expect.anything(),
    );
    expect(repository.saveCart).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: OTHER_RESTAURANT_ID }),
      expect.anything(),
    );
  });

  it.each([
    ['inactive food', () => food({ isActive: false })],
    ['unavailable food', () => food({ isAvailable: false })],
    [
      'closed restaurant',
      () => food({ restaurant: restaurant({ isOpen: false }) }),
    ],
    [
      'unapproved restaurant',
      () =>
        food({ restaurant: restaurant({ status: RestaurantStatus.PENDING }) }),
    ],
  ])('rejects %s before creating a cart item', async (_, createFood) => {
    const selectedFood = createFood();
    repository.findFoodByIdWithRestaurant.mockResolvedValue(selectedFood);

    await expect(
      service.addItem(
        customer(),
        Object.assign(new AddCartItemDto(), { foodItemId: selectedFood.id }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.createCartItem).not.toHaveBeenCalled();
  });

  it('updates quantity only for a cart item owned by the authenticated user', async () => {
    const item = cartItem();
    repository.findCartItemByIdForUser.mockResolvedValue(item);
    repository.findCartWithItemsByUserId.mockResolvedValue(
      cart({ items: [item] }),
    );

    await expect(
      service.updateItemQuantity(customer(), item.id, { quantity: 3 }),
    ).resolves.toMatchObject({ items: [{ quantity: 3 }] });
    expect(repository.findCartItemByIdForUser).toHaveBeenCalledWith(
      item.id,
      USER_ID,
      expect.anything(),
    );
  });

  it('does not allow cross-user cart item modification', async () => {
    repository.findCartItemByIdForUser.mockResolvedValue(null);

    await expect(
      service.updateItemQuantity(customer(), CART_ITEM_ID, { quantity: 2 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes the last item and clears the cart restaurant association', async () => {
    const existingCart = cart();
    const item = cartItem({ cart: existingCart });
    repository.findCartItemByIdForUser.mockResolvedValue(item);
    repository.countCartItems.mockResolvedValue(0);
    repository.findCartWithItemsByUserId.mockResolvedValue(
      cart({ restaurantId: null, restaurant: null, items: [] }),
    );

    await expect(
      service.removeItem(customer(), item.id),
    ).resolves.toMatchObject({
      restaurant: null,
      items: [],
    });
    expect(repository.deleteCartItem).toHaveBeenCalledWith(
      item.id,
      expect.anything(),
    );
    expect(repository.saveCart).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: null }),
      expect.anything(),
    );
  });

  it('clears all items while preserving an empty cart row', async () => {
    const existingCart = cart();
    repository.findCartWithItemsByUserId
      .mockResolvedValueOnce(existingCart)
      .mockResolvedValueOnce(
        cart({ restaurantId: null, restaurant: null, items: [] }),
      );

    await service.clearCart(customer());

    expect(repository.deleteAllCartItems).toHaveBeenCalledWith(
      existingCart.id,
      expect.anything(),
    );
    expect(repository.saveCart).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: null, couponCode: null }),
      expect.anything(),
    );
  });

  it('rejects inactive users before accessing cart storage', async () => {
    await expect(
      service.getCurrentCart(customer({ isActive: false })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.findCartWithItemsByUserId).not.toHaveBeenCalled();
  });
});

const USER_ID = '10000000-0000-4000-8000-000000000001';
const RESTAURANT_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_RESTAURANT_ID = '20000000-0000-4000-8000-000000000002';
const CART_ID = '30000000-0000-4000-8000-000000000001';
const CART_ITEM_ID = '40000000-0000-4000-8000-000000000001';
const FOOD_ID = '50000000-0000-4000-8000-000000000001';

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
    ownerId: '60000000-0000-4000-8000-000000000001',
    owner: customer({ id: '60000000-0000-4000-8000-000000000001' }),
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
