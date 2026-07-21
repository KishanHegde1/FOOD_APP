import { BadRequestException } from '@nestjs/common';
import { FoodSearchQueryDto } from './dto/food-search-query.dto';
import { HomeQueryDto } from './dto/home-query.dto';
import {
  RestaurantSearchQueryDto,
  RestaurantSearchSortBy,
} from './dto/restaurant-search-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchSuggestionsQueryDto } from './dto/search-suggestions-query.dto';
import { DiscoveryRepository } from './discovery.repository';
import { DiscoveryService } from './discovery.service';
import {
  DiscoveryFoodRecord,
  DiscoveryRestaurantRecord,
} from './interfaces/discovery-types';

describe('DiscoveryService', () => {
  let service: DiscoveryService;
  let repository: {
    findBestsellerFoods: jest.Mock;
    findPopularRestaurants: jest.Mock;
    findRecommendedFoods: jest.Mock;
    findRecommendedRestaurants: jest.Mock;
    findSearchSuggestions: jest.Mock;
    searchCombinedFoods: jest.Mock;
    searchCombinedRestaurants: jest.Mock;
    searchFoods: jest.Mock;
    searchRestaurants: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      findBestsellerFoods: jest.fn().mockResolvedValue([]),
      findPopularRestaurants: jest.fn().mockResolvedValue([]),
      findRecommendedFoods: jest.fn().mockResolvedValue([]),
      findRecommendedRestaurants: jest.fn().mockResolvedValue([]),
      findSearchSuggestions: jest.fn().mockResolvedValue([]),
      searchCombinedFoods: jest.fn().mockResolvedValue([]),
      searchCombinedRestaurants: jest.fn().mockResolvedValue([]),
      searchFoods: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      searchRestaurants: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    service = new DiscoveryService(
      repository as unknown as DiscoveryRepository,
    );
  });

  it('returns all bounded home sections and excludes already featured records', async () => {
    const popular = restaurant({ id: 'restaurant-popular' });
    const bestseller = food({ id: 'food-bestseller' });
    repository.findPopularRestaurants.mockResolvedValue([popular]);
    repository.findBestsellerFoods.mockResolvedValue([bestseller]);
    repository.findRecommendedRestaurants.mockResolvedValue([
      restaurant({ id: 'restaurant-recommended' }),
    ]);
    repository.findRecommendedFoods.mockResolvedValue([
      food({ id: 'food-recommended' }),
    ]);
    const query = Object.assign(new HomeQueryDto(), {
      city: 'Bengaluru',
      isPureVeg: true,
      restaurantLimit: 5,
      foodLimit: 4,
    });

    await expect(service.getHome(query)).resolves.toMatchObject({
      popularRestaurants: [{ id: popular.id, isPureVeg: false }],
      recommendedRestaurants: [{ id: 'restaurant-recommended' }],
      bestsellerFoods: [{ id: bestseller.id }],
      recommendedFoods: [{ id: 'food-recommended' }],
      metadata: { city: 'Bengaluru', pureVegOnly: true },
    });
    expect(repository.findPopularRestaurants).toHaveBeenCalledWith(query, 5);
    expect(repository.findBestsellerFoods).toHaveBeenCalledWith(query, 4);
    expect(repository.findRecommendedRestaurants).toHaveBeenCalledWith(
      query,
      5,
      [popular.id],
    );
    expect(repository.findRecommendedFoods).toHaveBeenCalledWith(query, 4, [
      bestseller.id,
    ]);
  });

  it('preserves omitted Pure Veg filtering so the repository can return both restaurant types', async () => {
    const query = Object.assign(new HomeQueryDto(), {
      city: 'Delhi',
      openNow: true,
      minimumRating: 4,
      maximumDeliveryMinutes: 30,
      maximumDeliveryFeePaise: 5000,
    });

    await service.getHome(query);

    expect(query.isPureVeg).toBeUndefined();
    expect(repository.findPopularRestaurants).toHaveBeenCalledWith(query, 10);
    expect(repository.findBestsellerFoods).toHaveBeenCalledWith(query, 10);
  });

  it.each([
    [Object.assign(new HomeQueryDto(), { latitude: 12.9 })],
    [Object.assign(new HomeQueryDto(), { radiusKm: 5 })],
  ])('rejects invalid home location combinations', async (query) => {
    await expect(service.getHome(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.findPopularRestaurants).not.toHaveBeenCalled();
  });

  it('searches restaurants with normalized text and pagination', async () => {
    repository.searchRestaurants.mockResolvedValue({
      items: [restaurant()],
      total: 3,
    });
    const query = Object.assign(new RestaurantSearchQueryDto(), {
      q: '  pizza   place ',
      page: 2,
      limit: 2,
      isPureVeg: false,
      sortBy: RestaurantSearchSortBy.RATING,
    });

    await expect(service.searchRestaurants(query)).resolves.toMatchObject({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
      items: [{ id: 'restaurant-1' }],
    });
    expect(repository.searchRestaurants).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'pizza place', isPureVeg: false }),
    );
  });

  it('rejects restaurant distance sorting without both coordinates', async () => {
    const query = Object.assign(new RestaurantSearchQueryDto(), {
      sortBy: RestaurantSearchSortBy.DISTANCE,
    });

    await expect(service.searchRestaurants(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.searchRestaurants).not.toHaveBeenCalled();
  });

  it('returns food search results while forwarding food-specific filters', async () => {
    repository.searchFoods.mockResolvedValue({ items: [food()], total: 1 });
    const query = Object.assign(new FoodSearchQueryDto(), {
      q: '  tofu ',
      isVeg: true,
      isBestseller: true,
      minimumPricePaise: 100,
      maximumPricePaise: 400,
      page: 1,
      limit: 20,
    });

    await expect(service.searchFoods(query)).resolves.toMatchObject({
      items: [{ id: 'food-1', isVeg: true }],
      total: 1,
    });
    expect(repository.searchFoods).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'tofu', isVeg: true, isBestseller: true }),
    );
  });

  it('rejects an invalid food price range before querying', async () => {
    const query = Object.assign(new FoodSearchQueryDto(), {
      minimumPricePaise: 500,
      maximumPricePaise: 100,
    });

    await expect(service.searchFoods(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.searchFoods).not.toHaveBeenCalled();
  });

  it('returns limited combined restaurant and food sections', async () => {
    repository.searchCombinedRestaurants.mockResolvedValue([restaurant()]);
    repository.searchCombinedFoods.mockResolvedValue([food()]);
    const query = Object.assign(new SearchQueryDto(), {
      q: '  pizza ',
      restaurantLimit: 3,
      foodLimit: 4,
      isPureVeg: true,
      isVeg: true,
    });

    await expect(service.search(query)).resolves.toMatchObject({
      query: 'pizza',
      metadata: { restaurantCount: 1, foodCount: 1 },
      restaurants: [{ id: 'restaurant-1' }],
      foods: [{ id: 'food-1', restaurantIsPureVeg: true }],
    });
    expect(repository.searchCombinedRestaurants).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'pizza', restaurantLimit: 3 }),
    );
    expect(repository.searchCombinedFoods).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'pizza', foodLimit: 4, isVeg: true }),
    );
  });

  it('deduplicates suggestion labels and applies the requested limit', async () => {
    repository.findSearchSuggestions.mockResolvedValue([
      {
        type: 'restaurant',
        id: 'restaurant-1',
        label: 'Pizza Place',
        subtitle: 'Restaurant',
        priority: 0,
      },
      {
        type: 'restaurant',
        id: 'restaurant-2',
        label: 'pizza place',
        subtitle: 'Restaurant',
        priority: 1,
      },
      {
        type: 'food',
        id: 'food-1',
        restaurantId: 'restaurant-1',
        label: 'Margherita',
        subtitle: 'Pizza Place',
        priority: 0,
      },
    ]);
    const query = Object.assign(new SearchSuggestionsQueryDto(), {
      q: ' pi ',
      limit: 2,
    });

    await expect(service.getSuggestions(query)).resolves.toEqual({
      suggestions: [
        {
          type: 'restaurant',
          id: 'restaurant-1',
          label: 'Pizza Place',
          subtitle: 'Restaurant',
        },
        {
          type: 'food',
          id: 'food-1',
          restaurantId: 'restaurant-1',
          label: 'Margherita',
          subtitle: 'Pizza Place',
        },
      ],
    });
  });

  it('rejects a suggestion query shorter than two characters', async () => {
    const query = Object.assign(new SearchSuggestionsQueryDto(), { q: 'x' });

    await expect(service.getSuggestions(query)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(repository.findSearchSuggestions).not.toHaveBeenCalled();
  });
});

function restaurant(
  overrides: Partial<DiscoveryRestaurantRecord> = {},
): DiscoveryRestaurantRecord {
  return {
    id: 'restaurant-1',
    name: 'Pizza Place',
    description: 'Fresh pizza',
    imageUrl: null,
    bannerUrl: null,
    city: 'Bengaluru',
    rating: 4.5,
    reviewCount: 20,
    deliveryTimeMinutes: 25,
    deliveryFeePaise: 3000,
    minimumOrderPaise: 10000,
    isPureVeg: false,
    isOpen: true,
    distanceKm: null,
    ...overrides,
  };
}

function food(
  overrides: Partial<DiscoveryFoodRecord> = {},
): DiscoveryFoodRecord {
  return {
    id: 'food-1',
    restaurantId: 'restaurant-1',
    restaurantName: 'Pizza Place',
    categoryId: null,
    categoryName: null,
    name: 'Margherita',
    description: 'Cheese pizza',
    imageUrl: null,
    pricePaise: 25000,
    originalPricePaise: null,
    rating: 4.5,
    reviewCount: 10,
    preparationMinutes: 20,
    isVeg: true,
    isBestseller: true,
    isAvailable: true,
    restaurantIsOpen: true,
    restaurantIsPureVeg: true,
    ...overrides,
  };
}
