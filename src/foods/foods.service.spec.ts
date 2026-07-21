import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { MenuCategory } from '../menu-categories/entities/menu-category.entity';
import { MenuCategoriesRepository } from '../menu-categories/menu-categories.repository';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodQueryDto } from './dto/food-query.dto';
import { Food } from './entities/food.entity';
import { FoodsRepository } from './foods.repository';
import { FoodsService } from './foods.service';

describe('FoodsService', () => {
  let service: FoodsService;
  let foodsRepository: {
    create: jest.Mock;
    findActiveMenuByRestaurantId: jest.Mock;
    findByCategoryId: jest.Mock;
    findById: jest.Mock;
    findByNameInRestaurant: jest.Mock;
    findByRestaurantId: jest.Mock;
    findManagementByRestaurantId: jest.Mock;
    findPublicById: jest.Mock;
    save: jest.Mock;
  };
  let restaurantsService: {
    findOneForManagement: jest.Mock;
    findOnePublic: jest.Mock;
  };
  let menuCategoriesRepository: {
    findById: jest.Mock;
    findPublicByRestaurantId: jest.Mock;
  };

  beforeEach(() => {
    foodsRepository = {
      create: jest.fn((data: Partial<Food>) => food(data)),
      findActiveMenuByRestaurantId: jest.fn(),
      findByCategoryId: jest.fn(),
      findById: jest.fn(),
      findByNameInRestaurant: jest.fn(),
      findByRestaurantId: jest.fn(),
      findManagementByRestaurantId: jest.fn(),
      findPublicById: jest.fn(),
      save: jest.fn((entity: Food) => Promise.resolve(entity)),
    };
    restaurantsService = {
      findOneForManagement: jest.fn(),
      findOnePublic: jest.fn(),
    };
    menuCategoriesRepository = {
      findById: jest.fn(),
      findPublicByRestaurantId: jest.fn(),
    };
    service = new FoodsService(
      foodsRepository as unknown as FoodsRepository,
      restaurantsService as unknown as RestaurantsService,
      menuCategoriesRepository as unknown as MenuCategoriesRepository,
    );
  });

  it('returns a paginated public list for an approved active restaurant', async () => {
    const query = Object.assign(new FoodQueryDto(), { page: 2, limit: 2 });
    restaurantsService.findOnePublic.mockResolvedValue({ id: RESTAURANT_ID });
    foodsRepository.findByRestaurantId.mockResolvedValue({
      items: [food()],
      total: 5,
    });

    await expect(
      service.findRestaurantFoods(RESTAURANT_ID, query),
    ).resolves.toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      items: [{ id: FOOD_ID }],
    });
    expect(restaurantsService.findOnePublic).toHaveBeenCalledWith(
      RESTAURANT_ID,
    );
    expect(foodsRepository.findByRestaurantId).toHaveBeenCalledWith(
      RESTAURANT_ID,
      query,
    );
  });

  it.each([
    ['vegetarian', true],
    ['non-vegetarian', false],
  ])(
    'passes the %s filter to the restaurant-scoped food query',
    async (_, isVeg) => {
      const query = Object.assign(new FoodQueryDto(), { isVeg });
      restaurantsService.findOnePublic.mockResolvedValue({ id: RESTAURANT_ID });
      foodsRepository.findByRestaurantId.mockResolvedValue({
        items: [],
        total: 0,
      });

      await service.findRestaurantFoods(RESTAURANT_ID, query);

      expect(foodsRepository.findByRestaurantId).toHaveBeenCalledWith(
        RESTAURANT_ID,
        expect.objectContaining({ isVeg }),
      );
    },
  );

  it('returns food only from the selected active menu category', async () => {
    const category = menuCategory();
    const query = new FoodQueryDto();
    restaurantsService.findOnePublic.mockResolvedValue({ id: RESTAURANT_ID });
    menuCategoriesRepository.findById.mockResolvedValue(category);
    foodsRepository.findByCategoryId.mockResolvedValue({
      items: [food({ categoryId: category.id, category })],
      total: 1,
    });

    await expect(
      service.findFoodsByCategory(RESTAURANT_ID, category.id, query),
    ).resolves.toMatchObject({ items: [{ categoryId: category.id }] });
    expect(foodsRepository.findByCategoryId).toHaveBeenCalledWith(
      RESTAURANT_ID,
      category.id,
      query,
    );
  });

  it('returns grouped menu categories in repository order and keeps unavailable active foods', async () => {
    const starters = menuCategory({
      id: CATEGORY_ID,
      name: 'Starters',
      sortOrder: 0,
    });
    const mains = menuCategory({
      id: '20000000-0000-4000-8000-000000000002',
      name: 'Mains',
      sortOrder: 1,
    });
    const desserts = menuCategory({
      id: '20000000-0000-4000-8000-000000000003',
      name: 'Desserts',
      sortOrder: 2,
    });
    restaurantsService.findOnePublic.mockResolvedValue({ id: RESTAURANT_ID });
    menuCategoriesRepository.findPublicByRestaurantId.mockResolvedValue([
      starters,
      mains,
      desserts,
    ]);
    foodsRepository.findActiveMenuByRestaurantId.mockResolvedValue([
      food({ categoryId: starters.id, category: starters, name: 'Soup' }),
      food({
        id: '30000000-0000-4000-8000-000000000002',
        categoryId: starters.id,
        category: starters,
        name: 'Salad',
        isAvailable: false,
      }),
      food({
        id: '30000000-0000-4000-8000-000000000003',
        categoryId: mains.id,
        category: mains,
        name: 'Curry',
      }),
      food({
        id: '30000000-0000-4000-8000-000000000004',
        categoryId: null,
        category: null,
        name: 'Bottled Water',
      }),
    ]);

    await expect(
      service.findRestaurantMenu(RESTAURANT_ID),
    ).resolves.toMatchObject({
      restaurantId: RESTAURANT_ID,
      categories: [
        {
          id: starters.id,
          items: [
            { name: 'Soup', isAvailable: true },
            { name: 'Salad', isAvailable: false },
          ],
        },
        { id: mains.id, items: [{ name: 'Curry' }] },
        { id: desserts.id, items: [] },
      ],
      uncategorizedItems: [{ name: 'Bottled Water' }],
    });
  });

  it('creates vegetarian food for a pure-veg restaurant', async () => {
    const pureVegRestaurant = restaurant({ isPureVeg: true });
    restaurantsService.findOneForManagement.mockResolvedValue(
      pureVegRestaurant,
    );
    foodsRepository.findByNameInRestaurant.mockResolvedValue(null);

    await expect(
      service.createForRestaurant(owner(), createFoodDto({ isVeg: true })),
    ).resolves.toMatchObject({
      isVeg: true,
      isAvailable: true,
      isBestseller: false,
    });
    expect(foodsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: pureVegRestaurant.id,
        isVeg: true,
        isActive: true,
      }),
    );
  });

  it('rejects non-vegetarian food for a pure-veg restaurant', async () => {
    restaurantsService.findOneForManagement.mockResolvedValue(
      restaurant({ isPureVeg: true }),
    );

    await expect(
      service.createForRestaurant(owner(), createFoodDto({ isVeg: false })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(foodsRepository.create).not.toHaveBeenCalled();
  });

  it('allows non-vegetarian food for a mixed restaurant', async () => {
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());
    foodsRepository.findByNameInRestaurant.mockResolvedValue(null);

    await expect(
      service.createForRestaurant(owner(), createFoodDto({ isVeg: false })),
    ).resolves.toMatchObject({ isVeg: false });
  });

  it('prevents customers from creating food items', async () => {
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());

    await expect(
      service.createForRestaurant(
        owner({ role: UserRole.CUSTOMER }),
        createFoodDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(foodsRepository.create).not.toHaveBeenCalled();
  });

  it("prevents an owner from modifying another restaurant's food", async () => {
    const otherRestaurant = restaurant({
      ownerId: '10000000-0000-4000-8000-000000000099',
    });
    foodsRepository.findById.mockResolvedValue(
      food({ restaurantId: otherRestaurant.id }),
    );
    restaurantsService.findOneForManagement.mockResolvedValue(otherRestaurant);

    await expect(
      service.updateOwnedFood(owner(), FOOD_ID, { name: 'Updated Soup' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(foodsRepository.save).not.toHaveBeenCalled();
  });

  it('rejects a category from another restaurant', async () => {
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());
    menuCategoriesRepository.findById.mockResolvedValue(
      menuCategory({
        restaurantId: '10000000-0000-4000-8000-000000000099',
      }),
    );

    await expect(
      service.createForRestaurant(
        owner(),
        createFoodDto({ categoryId: CATEGORY_ID }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(foodsRepository.create).not.toHaveBeenCalled();
  });

  it('validates the final original-price relationship on update', async () => {
    const existingFood = food({ pricePaise: 19900, originalPricePaise: 24900 });
    foodsRepository.findById.mockResolvedValue(existingFood);
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());

    await expect(
      service.updateOwnedFood(owner(), existingFood.id, { pricePaise: 30000 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(foodsRepository.save).not.toHaveBeenCalled();
  });

  it('validates an original-price-only update against the stored price', async () => {
    const existingFood = food({ pricePaise: 19900, originalPricePaise: null });
    foodsRepository.findById.mockResolvedValue(existingFood);
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());

    await expect(
      service.updateOwnedFood(owner(), existingFood.id, {
        originalPricePaise: 24900,
      }),
    ).resolves.toMatchObject({ originalPricePaise: 24900 });
  });

  it('updates temporary availability without changing active state', async () => {
    const existingFood = food({ isAvailable: true, isActive: true });
    foodsRepository.findById.mockResolvedValue(existingFood);
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());

    await expect(
      service.updateAvailability(owner(), existingFood.id, {
        isAvailable: false,
      }),
    ).resolves.toMatchObject({ isAvailable: false });
    expect(existingFood.isActive).toBe(true);
    expect(foodsRepository.save).toHaveBeenCalledWith(existingFood);
  });

  it('soft-deactivates food instead of deleting it', async () => {
    const existingFood = food({ isAvailable: true, isActive: true });
    foodsRepository.findById.mockResolvedValue(existingFood);
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());

    await expect(
      service.deactivateOwnedFood(owner(), existingFood.id),
    ).resolves.toBeUndefined();
    expect(existingFood).toMatchObject({ isActive: false, isAvailable: false });
    expect(foodsRepository.save).toHaveBeenCalledWith(existingFood);
  });

  it('raises a conflict for an active duplicate food name', async () => {
    restaurantsService.findOneForManagement.mockResolvedValue(restaurant());
    foodsRepository.findByNameInRestaurant.mockResolvedValue(food());

    await expect(
      service.createForRestaurant(owner(), createFoodDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

const RESTAURANT_ID = '10000000-0000-4000-8000-000000000001';
const CATEGORY_ID = '20000000-0000-4000-8000-000000000001';
const FOOD_ID = '30000000-0000-4000-8000-000000000001';

function createFoodDto(overrides: Partial<CreateFoodDto> = {}): CreateFoodDto {
  return {
    restaurantId: RESTAURANT_ID,
    name: 'Soup',
    pricePaise: 19900,
    isVeg: true,
    ...overrides,
  };
}

function owner(overrides: Partial<User> = {}): User {
  return {
    id: '10000000-0000-4000-8000-000000000010',
    firebaseUid: 'firebase-owner',
    phone: '+919876543210',
    name: 'Owner',
    email: 'owner@example.com',
    profileImage: null,
    role: UserRole.RESTAURANT_OWNER,
    isActive: true,
    phoneVerified: true,
    emailVerified: true,
    lastLoginAt: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: RESTAURANT_ID,
    ownerId: '10000000-0000-4000-8000-000000000010',
    owner: owner(),
    name: 'Good Food',
    slug: 'good-food-delhi',
    description: null,
    phone: null,
    email: null,
    logoUrl: null,
    bannerUrl: null,
    addressLine: '1 Main Street',
    locality: null,
    city: 'Delhi',
    state: null,
    postalCode: null,
    country: 'India',
    latitude: null,
    longitude: null,
    rating: 0,
    reviewCount: 0,
    averageDeliveryMinutes: 30,
    deliveryFeePaise: 0,
    minimumOrderPaise: 0,
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

function menuCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: CATEGORY_ID,
    restaurantId: RESTAURANT_ID,
    restaurant: restaurant(),
    name: 'Starters',
    description: null,
    imageUrl: null,
    sortOrder: 0,
    isActive: true,
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
    categoryId: CATEGORY_ID,
    category: menuCategory(),
    name: 'Soup',
    description: null,
    imageUrl: null,
    pricePaise: 19900,
    originalPricePaise: null,
    rating: 0,
    reviewCount: 0,
    preparationMinutes: 15,
    isVeg: true,
    isBestseller: false,
    isAvailable: true,
    isActive: true,
    sortOrder: 0,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}
