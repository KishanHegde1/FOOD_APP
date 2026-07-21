import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FoodSearchQueryDto } from './dto/food-search-query.dto';
import {
  DiscoveryFoodCardDto,
  DiscoveryRestaurantCardDto,
  HomeResponseDto,
} from './dto/home-response.dto';
import { HomeQueryDto } from './dto/home-query.dto';
import {
  PaginatedFoodSearchResponseDto,
  PaginatedRestaurantSearchResponseDto,
  SearchResponseDto,
} from './dto/search-response.dto';
import {
  RestaurantSearchQueryDto,
  RestaurantSearchSortBy,
} from './dto/restaurant-search-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchSuggestionDto,
  SearchSuggestionsResponseDto,
  SearchSuggestionType,
} from './dto/search-suggestions-response.dto';
import { SearchSuggestionsQueryDto } from './dto/search-suggestions-query.dto';
import {
  DiscoveryFoodRecord,
  DiscoveryRestaurantRecord,
} from './interfaces/discovery-types';
import { DiscoveryRepository } from './discovery.repository';

@Injectable()
export class DiscoveryService {
  constructor(private readonly discoveryRepository: DiscoveryRepository) {}

  async getHome(query: HomeQueryDto): Promise<HomeResponseDto> {
    return this.safely(async () => {
      this.validateLocation(query);
      const [popularRestaurants, bestsellerFoods] = await Promise.all([
        this.discoveryRepository.findPopularRestaurants(
          query,
          query.restaurantLimit,
        ),
        this.discoveryRepository.findBestsellerFoods(query, query.foodLimit),
      ]);
      const [recommendedRestaurants, recommendedFoods] = await Promise.all([
        this.discoveryRepository.findRecommendedRestaurants(
          query,
          query.restaurantLimit,
          popularRestaurants.map((restaurant) => restaurant.id),
        ),
        this.discoveryRepository.findRecommendedFoods(
          query,
          query.foodLimit,
          bestsellerFoods.map((food) => food.id),
        ),
      ]);

      return {
        popularRestaurants: popularRestaurants.map((restaurant) =>
          this.toRestaurantCard(restaurant),
        ),
        recommendedRestaurants: recommendedRestaurants.map((restaurant) =>
          this.toRestaurantCard(restaurant),
        ),
        bestsellerFoods: bestsellerFoods.map((food) => this.toFoodCard(food)),
        recommendedFoods: recommendedFoods.map((food) => this.toFoodCard(food)),
        metadata: {
          city: query.city?.trim() || null,
          pureVegOnly: query.isPureVeg === true,
        },
      };
    });
  }

  async searchRestaurants(
    query: RestaurantSearchQueryDto,
  ): Promise<PaginatedRestaurantSearchResponseDto> {
    return this.safely(async () => {
      this.validateLocation(query);
      if (
        query.sortBy === RestaurantSearchSortBy.DISTANCE &&
        (query.latitude === undefined || query.longitude === undefined)
      ) {
        throw new BadRequestException(
          'Distance sorting requires both latitude and longitude.',
        );
      }
      if (query.q) {
        query.q = this.normalizeSearchQuery(query.q);
      }

      const { items, total } =
        await this.discoveryRepository.searchRestaurants(query);
      return {
        items: items.map((restaurant) => this.toRestaurantCard(restaurant)),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    });
  }

  async searchFoods(
    query: FoodSearchQueryDto,
  ): Promise<PaginatedFoodSearchResponseDto> {
    return this.safely(async () => {
      this.validatePriceRange(query);
      if (query.q) {
        query.q = this.normalizeSearchQuery(query.q);
      }

      const { items, total } =
        await this.discoveryRepository.searchFoods(query);
      return {
        items: items.map((food) => this.toFoodCard(food)),
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      };
    });
  }

  async search(query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.safely(async () => {
      this.validateLocation(query);
      query.q = this.normalizeSearchQuery(query.q);
      const [restaurants, foods] = await Promise.all([
        this.discoveryRepository.searchCombinedRestaurants(query),
        this.discoveryRepository.searchCombinedFoods(query),
      ]);

      return {
        query: query.q,
        restaurants: restaurants.map((restaurant) =>
          this.toRestaurantCard(restaurant),
        ),
        foods: foods.map((food) => this.toFoodCard(food)),
        metadata: {
          restaurantCount: restaurants.length,
          foodCount: foods.length,
        },
      };
    });
  }

  async getSuggestions(
    query: SearchSuggestionsQueryDto,
  ): Promise<SearchSuggestionsResponseDto> {
    return this.safely(async () => {
      query.q = this.normalizeSearchQuery(query.q);
      const records =
        await this.discoveryRepository.findSearchSuggestions(query);
      const seenLabels = new Set<string>();
      const suggestions: SearchSuggestionDto[] = [];

      for (const record of records) {
        const key = `${record.type}:${record.label.toLocaleLowerCase()}`;
        if (seenLabels.has(key)) {
          continue;
        }
        seenLabels.add(key);
        suggestions.push({
          type:
            record.type === 'restaurant'
              ? SearchSuggestionType.RESTAURANT
              : SearchSuggestionType.FOOD,
          id: record.id,
          ...(record.restaurantId ? { restaurantId: record.restaurantId } : {}),
          label: record.label,
          subtitle: record.subtitle,
        });
        if (suggestions.length === query.limit) {
          break;
        }
      }

      return { suggestions };
    });
  }

  private validateLocation(query: {
    latitude?: number;
    longitude?: number;
    radiusKm?: number;
  }): void {
    const hasLatitude = query.latitude !== undefined;
    const hasLongitude = query.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        'Latitude and longitude must be provided together.',
      );
    }
    if (query.radiusKm !== undefined && !hasLatitude) {
      throw new BadRequestException(
        'radiusKm requires both latitude and longitude.',
      );
    }
  }

  private validatePriceRange(query: {
    minimumPricePaise?: number;
    maximumPricePaise?: number;
  }): void {
    if (
      query.minimumPricePaise !== undefined &&
      query.maximumPricePaise !== undefined &&
      query.minimumPricePaise > query.maximumPricePaise
    ) {
      throw new BadRequestException(
        'maximumPricePaise must be greater than or equal to minimumPricePaise.',
      );
    }
  }

  private normalizeSearchQuery(query: string): string {
    const normalized = query.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2) {
      throw new BadRequestException(
        'Search query must contain at least 2 characters.',
      );
    }
    if (normalized.length > 100) {
      throw new BadRequestException(
        'Search query cannot exceed 100 characters.',
      );
    }
    return normalized;
  }

  private toRestaurantCard(
    restaurant: DiscoveryRestaurantRecord,
  ): DiscoveryRestaurantCardDto {
    return {
      id: restaurant.id,
      name: restaurant.name,
      description: restaurant.description,
      imageUrl: restaurant.imageUrl,
      bannerUrl: restaurant.bannerUrl,
      city: restaurant.city,
      rating: restaurant.rating,
      reviewCount: restaurant.reviewCount,
      deliveryTimeMinutes: restaurant.deliveryTimeMinutes,
      deliveryFeePaise: restaurant.deliveryFeePaise,
      minimumOrderPaise: restaurant.minimumOrderPaise,
      isPureVeg: restaurant.isPureVeg,
      isOpen: restaurant.isOpen,
      ...(restaurant.distanceKm === null
        ? {}
        : { distanceKm: restaurant.distanceKm }),
    };
  }

  private toFoodCard(food: DiscoveryFoodRecord): DiscoveryFoodCardDto {
    return {
      id: food.id,
      restaurantId: food.restaurantId,
      restaurantName: food.restaurantName,
      categoryId: food.categoryId,
      categoryName: food.categoryName,
      name: food.name,
      description: food.description,
      imageUrl: food.imageUrl,
      pricePaise: food.pricePaise,
      originalPricePaise: food.originalPricePaise,
      rating: food.rating,
      reviewCount: food.reviewCount,
      preparationMinutes: food.preparationMinutes,
      isVeg: food.isVeg,
      isBestseller: food.isBestseller,
      isAvailable: food.isAvailable,
      restaurantIsOpen: food.restaurantIsOpen,
      restaurantIsPureVeg: food.restaurantIsPureVeg,
    };
  }

  private async safely<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Unable to load discovery data.');
    }
  }
}
