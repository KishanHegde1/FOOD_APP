import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuCategoriesRepository } from './menu-categories.repository';
import { MenuCategoriesService } from './menu-categories.service';

describe('MenuCategoriesService', () => {
  let service: MenuCategoriesService;
  let repository: {
    create: jest.Mock;
    findById: jest.Mock;
    findByIdsAndRestaurantId: jest.Mock;
    findByNameAndRestaurant: jest.Mock;
    findByRestaurantId: jest.Mock;
    findPublicByRestaurantId: jest.Mock;
    save: jest.Mock;
    saveMany: jest.Mock;
  };
  let restaurantsService: {
    findOneForManagement: jest.Mock;
    findOnePublic: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<MenuCategory>) => category(data)),
      findById: jest.fn(),
      findByIdsAndRestaurantId: jest.fn(),
      findByNameAndRestaurant: jest.fn(),
      findByRestaurantId: jest.fn(),
      findPublicByRestaurantId: jest.fn(),
      save: jest.fn((entity: MenuCategory) => Promise.resolve(entity)),
      saveMany: jest.fn((entities: MenuCategory[]) =>
        Promise.resolve(entities),
      ),
    };
    restaurantsService = {
      findOneForManagement: jest.fn(),
      findOnePublic: jest.fn(),
    };
    service = new MenuCategoriesService(
      repository as unknown as MenuCategoriesRepository,
      restaurantsService as unknown as RestaurantsService,
    );
  });

  it('returns active categories in repository sort order for a public restaurant', async () => {
    const publicRestaurant = restaurant();
    restaurantsService.findOnePublic.mockResolvedValue({
      id: publicRestaurant.id,
    });
    repository.findPublicByRestaurantId.mockResolvedValue([
      category({
        id: '10000000-0000-4000-8000-000000000102',
        name: 'Drinks',
        sortOrder: 0,
      }),
      category({
        id: '10000000-0000-4000-8000-000000000101',
        name: 'Starters',
        sortOrder: 1,
      }),
    ]);

    await expect(
      service.findPublicByRestaurantId(publicRestaurant.id),
    ).resolves.toMatchObject([
      { name: 'Drinks', sortOrder: 0 },
      { name: 'Starters', sortOrder: 1 },
    ]);
    expect(repository.findPublicByRestaurantId).toHaveBeenCalledWith(
      publicRestaurant.id,
    );
  });

  it('rejects public categories for a missing restaurant', async () => {
    restaurantsService.findOnePublic.mockRejectedValue(
      new NotFoundException('Restaurant not found.'),
    );

    await expect(
      service.findPublicByRestaurantId('10000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a category for the restaurant owner', async () => {
    const ownedRestaurant = restaurant();
    restaurantsService.findOneForManagement.mockResolvedValue(ownedRestaurant);
    repository.findByNameAndRestaurant.mockResolvedValue(null);
    repository.findByRestaurantId.mockResolvedValue([]);

    await expect(
      service.create(user(), {
        restaurantId: ownedRestaurant.id,
        name: 'Starters',
      }),
    ).resolves.toMatchObject({
      restaurantId: ownedRestaurant.id,
      name: 'Starters',
      sortOrder: 0,
    });
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: ownedRestaurant.id,
        name: 'Starters',
        isActive: true,
      }),
    );
  });

  it('prevents duplicate names within a restaurant', async () => {
    const ownedRestaurant = restaurant();
    restaurantsService.findOneForManagement.mockResolvedValue(ownedRestaurant);
    repository.findByNameAndRestaurant.mockResolvedValue(category());

    await expect(
      service.create(user(), {
        restaurantId: ownedRestaurant.id,
        name: 'Starters',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('prevents an owner from updating a category in another restaurant', async () => {
    const otherRestaurant = restaurant({
      ownerId: '10000000-0000-4000-8000-000000000099',
    });
    const existingCategory = category({ restaurantId: otherRestaurant.id });
    repository.findById.mockResolvedValue(existingCategory);
    restaurantsService.findOneForManagement.mockResolvedValue(otherRestaurant);

    await expect(
      service.update(user(), existingCategory.id, { name: 'Updated Starters' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('deactivates a category instead of deleting it', async () => {
    const ownedRestaurant = restaurant();
    const existingCategory = category({ restaurantId: ownedRestaurant.id });
    repository.findById.mockResolvedValue(existingCategory);
    restaurantsService.findOneForManagement.mockResolvedValue(ownedRestaurant);

    await expect(
      service.deactivate(user(), existingCategory.id),
    ).resolves.toBeUndefined();

    expect(existingCategory.isActive).toBe(false);
    expect(repository.save).toHaveBeenCalledWith(existingCategory);
  });

  it('reorders only categories belonging to the owned restaurant', async () => {
    const ownedRestaurant = restaurant();
    const starters = category({
      id: '10000000-0000-4000-8000-000000000101',
      restaurantId: ownedRestaurant.id,
      sortOrder: 0,
    });
    const drinks = category({
      id: '10000000-0000-4000-8000-000000000102',
      restaurantId: ownedRestaurant.id,
      sortOrder: 1,
    });
    restaurantsService.findOneForManagement.mockResolvedValue(ownedRestaurant);
    repository.findByIdsAndRestaurantId.mockResolvedValue([starters, drinks]);

    await expect(
      service.reorder(user(), ownedRestaurant.id, [
        { id: starters.id, sortOrder: 4 },
        { id: drinks.id, sortOrder: 1 },
      ]),
    ).resolves.toMatchObject([
      { id: drinks.id, sortOrder: 1 },
      { id: starters.id, sortOrder: 4 },
    ]);
    expect(repository.saveMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: starters.id, sortOrder: 4 }),
        expect.objectContaining({ id: drinks.id, sortOrder: 1 }),
      ]),
    );
  });
});

function user(overrides: Partial<User> = {}): User {
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
    id: '10000000-0000-4000-8000-000000000001',
    ownerId: '10000000-0000-4000-8000-000000000010',
    owner: user(),
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
    isOpen: false,
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

function category(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: '10000000-0000-4000-8000-000000000101',
    restaurantId: '10000000-0000-4000-8000-000000000001',
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
