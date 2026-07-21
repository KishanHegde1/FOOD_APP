import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { RestaurantQueryDto } from './dto/restaurant-query.dto';
import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';
import { RestaurantsRepository } from './restaurants.repository';
import { RestaurantsService } from './restaurants.service';

describe('RestaurantsService', () => {
  let service: RestaurantsService;
  let repository: {
    create: jest.Mock;
    existsByNameAndCity: jest.Mock;
    findById: jest.Mock;
    findByOwnerId: jest.Mock;
    findBySlug: jest.Mock;
    findPublicById: jest.Mock;
    findPublicList: jest.Mock;
    save: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<Restaurant>) => restaurant(data)),
      existsByNameAndCity: jest.fn(),
      findById: jest.fn(),
      findByOwnerId: jest.fn(),
      findBySlug: jest.fn(),
      findPublicById: jest.fn(),
      findPublicList: jest.fn(),
      save: jest.fn((entity: Restaurant) => Promise.resolve(entity)),
    };
    service = new RestaurantsService(
      repository as unknown as RestaurantsRepository,
    );
  });

  it('returns the approved active page supplied by the public repository query', async () => {
    const query = Object.assign(new RestaurantQueryDto(), {
      page: 2,
      limit: 2,
      search: 'pizza',
      city: 'Delhi',
    });
    repository.findPublicList.mockResolvedValue({
      items: [
        restaurant({ id: '10000000-0000-4000-8000-000000000001' }),
        restaurant({ id: '10000000-0000-4000-8000-000000000002' }),
      ],
      total: 5,
    });

    await expect(service.findAllPublic(query)).resolves.toMatchObject({
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
      items: [
        { id: '10000000-0000-4000-8000-000000000001' },
        { id: '10000000-0000-4000-8000-000000000002' },
      ],
    });
    expect(repository.findPublicList).toHaveBeenCalledWith(query);
  });

  it('rejects a hidden or inactive restaurant detail', async () => {
    repository.findPublicById.mockResolvedValue(null);

    await expect(
      service.findOnePublic('10000000-0000-4000-8000-000000000001'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a pending restaurant for an owner using the backend user ID', async () => {
    repository.existsByNameAndCity.mockResolvedValue(false);
    repository.findBySlug.mockResolvedValue(null);
    const owner = user({ role: UserRole.RESTAURANT_OWNER });

    const result = await service.createForOwner(owner, createRestaurantDto());

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: owner.id,
        status: RestaurantStatus.PENDING,
        isActive: true,
        isOpen: false,
        rating: 0,
        reviewCount: 0,
        slug: 'good-food-delhi',
      }),
    );
    expect(result).toMatchObject({ name: 'Good Food', city: 'Delhi' });
  });

  it('prevents a customer from creating restaurants', async () => {
    await expect(
      service.createForOwner(
        user({ role: UserRole.CUSTOMER }),
        createRestaurantDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("prevents an owner from updating another owner's restaurant", async () => {
    repository.findById.mockResolvedValue(
      restaurant({ ownerId: '10000000-0000-4000-8000-000000000099' }),
    );

    await expect(
      service.updateOwnedRestaurant(
        user(),
        '10000000-0000-4000-8000-000000000001',
        {
          name: 'Updated Food',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('deactivates a restaurant instead of deleting it', async () => {
    const ownedRestaurant = restaurant({ isOpen: true });
    repository.findById.mockResolvedValue(ownedRestaurant);

    await expect(
      service.deactivateOwnedRestaurant(user(), ownedRestaurant.id),
    ).resolves.toBeUndefined();

    expect(ownedRestaurant).toMatchObject({ isActive: false, isOpen: false });
    expect(repository.save).toHaveBeenCalledWith(ownedRestaurant);
  });
});

function createRestaurantDto(): CreateRestaurantDto {
  return {
    name: 'Good Food',
    addressLine: '1 Main Street',
    city: 'Delhi',
  };
}

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
