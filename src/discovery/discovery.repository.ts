import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Food } from '../foods/entities/food.entity';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  FoodSearchQueryDto,
  FoodSearchSortBy,
} from './dto/food-search-query.dto';
import { HomeQueryDto } from './dto/home-query.dto';
import {
  DiscoverySortOrder,
  RestaurantSearchQueryDto,
  RestaurantSearchSortBy,
} from './dto/restaurant-search-query.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchSuggestionsQueryDto } from './dto/search-suggestions-query.dto';
import {
  DiscoveryFoodRecord,
  DiscoveryRestaurantRecord,
  DiscoverySuggestionRecord,
  FoodDiscoveryFilters,
  RestaurantDiscoveryFilters,
} from './interfaces/discovery-types';

export interface PaginatedDiscoveryResult<T> {
  items: T[];
  total: number;
}

@Injectable()
export class DiscoveryRepository {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurants: Repository<Restaurant>,
    @InjectRepository(Food)
    private readonly foods: Repository<Food>,
  ) {}

  async findPopularRestaurants(
    query: HomeQueryDto,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<DiscoveryRestaurantRecord[]> {
    const builder = this.createPublicRestaurantQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.excludeRestaurants(builder, excludeIds);
    this.selectRestaurantCards(builder, query);
    builder
      .orderBy('restaurant.rating', 'DESC')
      .addOrderBy('restaurant.review_count', 'DESC')
      .addOrderBy('restaurant.created_at', 'DESC')
      .addOrderBy('restaurant.id', 'ASC')
      .take(limit);

    return this.mapRestaurantRows(await this.getRawRows(builder));
  }

  async findRecommendedRestaurants(
    query: HomeQueryDto,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<DiscoveryRestaurantRecord[]> {
    const builder = this.createPublicRestaurantQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.excludeRestaurants(builder, excludeIds);
    this.selectRestaurantCards(builder, query);
    builder
      .orderBy('restaurant.is_open', 'DESC')
      .addOrderBy('restaurant.rating', 'DESC')
      .addOrderBy('restaurant.average_delivery_minutes', 'ASC')
      .addOrderBy('restaurant.delivery_fee_paise', 'ASC')
      .addOrderBy('restaurant.review_count', 'DESC')
      .addOrderBy('restaurant.id', 'ASC')
      .take(limit);

    return this.mapRestaurantRows(await this.getRawRows(builder));
  }

  async findBestsellerFoods(
    query: HomeQueryDto,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<DiscoveryFoodRecord[]> {
    const builder = this.createPublicFoodQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.applyFoodFilters(builder, query);
    builder.andWhere('food.is_bestseller = :isBestseller', {
      isBestseller: true,
    });
    this.excludeFoods(builder, excludeIds);
    this.selectFoodCards(builder);
    builder
      .orderBy('food.rating', 'DESC')
      .addOrderBy('food.review_count', 'DESC')
      .addOrderBy('food.sort_order', 'ASC')
      .addOrderBy('food.name', 'ASC')
      .addOrderBy('food.id', 'ASC')
      .take(limit);

    return this.mapFoodRows(await this.getRawRows(builder));
  }

  async findRecommendedFoods(
    query: HomeQueryDto,
    limit: number,
    excludeIds: string[] = [],
  ): Promise<DiscoveryFoodRecord[]> {
    const builder = this.createPublicFoodQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.applyFoodFilters(builder, query);
    this.excludeFoods(builder, excludeIds);
    this.selectFoodCards(builder);
    builder
      .orderBy('food.rating', 'DESC')
      .addOrderBy('food.review_count', 'DESC')
      .addOrderBy('food.is_bestseller', 'DESC')
      .addOrderBy('food.created_at', 'DESC')
      .addOrderBy('food.id', 'ASC')
      .take(limit);

    return this.mapFoodRows(await this.getRawRows(builder));
  }

  async searchRestaurants(
    query: RestaurantSearchQueryDto,
  ): Promise<PaginatedDiscoveryResult<DiscoveryRestaurantRecord>> {
    const builder = this.createPublicRestaurantQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    const hasQuery = Boolean(query.q);
    if (query.q) {
      this.applyRestaurantSearch(builder, query.q);
    }
    this.selectRestaurantCards(builder, query);
    if (hasQuery) {
      this.addRestaurantRelevance(builder, query.q!);
    }
    this.applyRestaurantSearchOrdering(builder, query, hasQuery);

    const total = await builder.clone().getCount();
    builder.skip((query.page - 1) * query.limit).take(query.limit);
    const items = this.mapRestaurantRows(await this.getRawRows(builder));
    return { items, total };
  }

  async searchFoods(
    query: FoodSearchQueryDto,
  ): Promise<PaginatedDiscoveryResult<DiscoveryFoodRecord>> {
    const builder = this.createPublicFoodQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.applyFoodFilters(builder, query);
    const hasQuery = Boolean(query.q);
    if (query.q) {
      this.applyFoodSearch(builder, query.q);
    }
    this.selectFoodCards(builder);
    if (hasQuery) {
      this.addFoodRelevance(builder, query.q!);
    }
    this.applyFoodSearchOrdering(builder, query, hasQuery);

    const total = await builder.clone().getCount();
    builder.skip((query.page - 1) * query.limit).take(query.limit);
    const items = this.mapFoodRows(await this.getRawRows(builder));
    return { items, total };
  }

  async searchCombinedRestaurants(
    query: SearchQueryDto,
  ): Promise<DiscoveryRestaurantRecord[]> {
    const builder = this.createPublicRestaurantQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.applyRestaurantSearch(builder, query.q);
    this.selectRestaurantCards(builder, query);
    this.addRestaurantRelevance(builder, query.q);
    builder
      .orderBy('relevance', 'ASC')
      .addOrderBy('restaurant.rating', 'DESC')
      .addOrderBy('restaurant.id', 'ASC')
      .take(query.restaurantLimit);

    return this.mapRestaurantRows(await this.getRawRows(builder));
  }

  async searchCombinedFoods(
    query: SearchQueryDto,
  ): Promise<DiscoveryFoodRecord[]> {
    const builder = this.createPublicFoodQuery();
    this.applyRestaurantFilters(builder, 'restaurant', query);
    this.applyFoodFilters(builder, query);
    this.applyFoodSearch(builder, query.q);
    this.selectFoodCards(builder);
    this.addFoodRelevance(builder, query.q);
    builder
      .orderBy('relevance', 'ASC')
      .addOrderBy('food.rating', 'DESC')
      .addOrderBy('food.id', 'ASC')
      .take(query.foodLimit);

    return this.mapFoodRows(await this.getRawRows(builder));
  }

  async findSearchSuggestions(
    query: SearchSuggestionsQueryDto,
  ): Promise<DiscoverySuggestionRecord[]> {
    const candidateLimit = Math.min(query.limit * 2, 30);
    const [restaurantRows, foodRows] = await Promise.all([
      this.findRestaurantSuggestionRows(query, candidateLimit),
      this.findFoodSuggestionRows(query, candidateLimit),
    ]);

    return [...restaurantRows, ...foodRows].sort(
      (first, second) =>
        first.priority - second.priority ||
        first.label.localeCompare(second.label) ||
        first.id.localeCompare(second.id),
    );
  }

  private createPublicRestaurantQuery(): SelectQueryBuilder<Restaurant> {
    return this.restaurants
      .createQueryBuilder('restaurant')
      .where('restaurant.is_active = :restaurantIsActive', {
        restaurantIsActive: true,
      })
      .andWhere('restaurant.status = :restaurantStatus', {
        restaurantStatus: RestaurantStatus.APPROVED,
      });
  }

  private createPublicFoodQuery(): SelectQueryBuilder<Food> {
    return this.foods
      .createQueryBuilder('food')
      .innerJoin('food.restaurant', 'restaurant')
      .leftJoin('food.category', 'category')
      .where('food.is_active = :foodIsActive', { foodIsActive: true })
      .andWhere('food.is_available = :foodIsAvailable', {
        foodIsAvailable: true,
      })
      .andWhere('restaurant.is_active = :restaurantIsActive', {
        restaurantIsActive: true,
      })
      .andWhere('restaurant.status = :restaurantStatus', {
        restaurantStatus: RestaurantStatus.APPROVED,
      });
  }

  private applyRestaurantFilters<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    alias: 'restaurant',
    query: RestaurantDiscoveryFilters,
  ): void {
    if (query.latitude !== undefined && query.longitude !== undefined) {
      builder.setParameters({
        latitude: query.latitude,
        longitude: query.longitude,
      });
    }
    const city = query.city?.trim();
    if (city) {
      builder.andWhere(`LOWER(${alias}.city) = LOWER(:city)`, { city });
    }
    if (query.isPureVeg !== undefined) {
      builder.andWhere(`${alias}.is_pure_veg = :isPureVeg`, {
        isPureVeg: query.isPureVeg,
      });
    }
    if (query.openNow === true) {
      builder.andWhere(`${alias}.is_open = :openNow`, { openNow: true });
    }
    if (query.minimumRating !== undefined) {
      builder.andWhere(`COALESCE(${alias}.rating, 0) >= :minimumRating`, {
        minimumRating: query.minimumRating,
      });
    }
    if (query.maximumDeliveryMinutes !== undefined) {
      builder.andWhere(
        `${alias}.average_delivery_minutes <= :maximumDeliveryMinutes`,
        { maximumDeliveryMinutes: query.maximumDeliveryMinutes },
      );
    }
    if (query.maximumDeliveryFeePaise !== undefined) {
      builder.andWhere(
        `${alias}.delivery_fee_paise <= :maximumDeliveryFeePaise`,
        { maximumDeliveryFeePaise: query.maximumDeliveryFeePaise },
      );
    }
    if (query.radiusKm !== undefined) {
      builder
        .andWhere(`${alias}.location IS NOT NULL`)
        .andWhere(
          `ST_DWithin(${alias}.location, ${this.locationPointExpression()}, :radiusMeters)`,
          {
            latitude: query.latitude,
            longitude: query.longitude,
            radiusMeters: query.radiusKm * 1000,
          },
        );
    }
  }

  private applyFoodFilters<T extends Food>(
    builder: SelectQueryBuilder<T>,
    query: FoodDiscoveryFilters,
  ): void {
    if (query.restaurantId) {
      builder.andWhere('food.restaurant_id = :foodRestaurantId', {
        foodRestaurantId: query.restaurantId,
      });
    }
    if (query.categoryId) {
      builder.andWhere('food.category_id = :foodCategoryId', {
        foodCategoryId: query.categoryId,
      });
    }
    if (query.isVeg !== undefined) {
      builder.andWhere('food.is_veg = :foodIsVeg', { foodIsVeg: query.isVeg });
    }
    if (query.isBestseller !== undefined) {
      builder.andWhere('food.is_bestseller = :foodIsBestseller', {
        foodIsBestseller: query.isBestseller,
      });
    }
    if (query.minimumRating !== undefined) {
      builder.andWhere('COALESCE(food.rating, 0) >= :foodMinimumRating', {
        foodMinimumRating: query.minimumRating,
      });
    }
    if (query.minimumPricePaise !== undefined) {
      builder.andWhere('food.price_paise >= :minimumPricePaise', {
        minimumPricePaise: query.minimumPricePaise,
      });
    }
    if (query.maximumPricePaise !== undefined) {
      builder.andWhere('food.price_paise <= :maximumPricePaise', {
        maximumPricePaise: query.maximumPricePaise,
      });
    }
    if (query.isPureVeg === true) {
      builder.andWhere('food.is_veg = :pureVegFood', { pureVegFood: true });
    }
  }

  private applyRestaurantSearch(
    builder: SelectQueryBuilder<Restaurant>,
    query: string,
  ): void {
    const patterns = this.likePatterns(query);
    builder.andWhere(
      `(restaurant.name ILIKE :restaurantContains ESCAPE '!' OR restaurant.description ILIKE :restaurantContains ESCAPE '!' OR restaurant.city ILIKE :restaurantContains ESCAPE '!')`,
      { restaurantContains: patterns.contains },
    );
  }

  private applyFoodSearch(
    builder: SelectQueryBuilder<Food>,
    query: string,
  ): void {
    const patterns = this.likePatterns(query);
    builder.andWhere(
      `(food.name ILIKE :foodContains ESCAPE '!' OR food.description ILIKE :foodContains ESCAPE '!' OR restaurant.name ILIKE :foodContains ESCAPE '!' OR category.name ILIKE :foodContains ESCAPE '!')`,
      { foodContains: patterns.contains },
    );
  }

  private addRestaurantRelevance(
    builder: SelectQueryBuilder<Restaurant>,
    query: string,
  ): void {
    const patterns = this.likePatterns(query);
    builder.addSelect(
      `CASE WHEN LOWER(restaurant.name) = LOWER(:restaurantExact) THEN 0 WHEN restaurant.name ILIKE :restaurantPrefix ESCAPE '!' THEN 1 WHEN restaurant.name ILIKE :restaurantContains ESCAPE '!' THEN 2 WHEN restaurant.description ILIKE :restaurantContains ESCAPE '!' THEN 3 ELSE 4 END`,
      'relevance',
    );
    builder.setParameters({
      restaurantExact: query,
      restaurantPrefix: patterns.prefix,
      restaurantContains: patterns.contains,
    });
  }

  private addFoodRelevance(
    builder: SelectQueryBuilder<Food>,
    query: string,
  ): void {
    const patterns = this.likePatterns(query);
    builder.addSelect(
      `CASE WHEN LOWER(food.name) = LOWER(:foodExact) THEN 0 WHEN food.name ILIKE :foodPrefix ESCAPE '!' THEN 1 WHEN food.name ILIKE :foodContains ESCAPE '!' THEN 2 WHEN restaurant.name ILIKE :foodPrefix ESCAPE '!' THEN 3 WHEN food.description ILIKE :foodContains ESCAPE '!' THEN 4 ELSE 5 END`,
      'relevance',
    );
    builder.setParameters({
      foodExact: query,
      foodPrefix: patterns.prefix,
      foodContains: patterns.contains,
    });
  }

  private applyRestaurantSearchOrdering(
    builder: SelectQueryBuilder<Restaurant>,
    query: RestaurantSearchQueryDto,
    hasQuery: boolean,
  ): void {
    const requestedSortBy =
      query.sortBy === RestaurantSearchSortBy.RELEVANCE && !hasQuery
        ? RestaurantSearchSortBy.RATING
        : query.sortBy;
    const sortBy =
      requestedSortBy ??
      (hasQuery
        ? RestaurantSearchSortBy.RELEVANCE
        : RestaurantSearchSortBy.RATING);
    const sortOrder =
      query.sortOrder ??
      (sortBy === RestaurantSearchSortBy.RELEVANCE
        ? DiscoverySortOrder.ASC
        : DiscoverySortOrder.DESC);
    const sortColumns: Record<RestaurantSearchSortBy, string> = {
      [RestaurantSearchSortBy.RELEVANCE]: 'relevance',
      [RestaurantSearchSortBy.RATING]: 'restaurant.rating',
      [RestaurantSearchSortBy.DELIVERY_TIME]:
        'restaurant.average_delivery_minutes',
      [RestaurantSearchSortBy.DELIVERY_FEE]: 'restaurant.delivery_fee_paise',
      [RestaurantSearchSortBy.NAME]: 'restaurant.name',
      [RestaurantSearchSortBy.CREATED_AT]: 'restaurant.created_at',
      [RestaurantSearchSortBy.DISTANCE]: 'distance_km',
    };
    builder
      .orderBy(sortColumns[sortBy], sortOrder)
      .addOrderBy('restaurant.id', DiscoverySortOrder.ASC);
  }

  private applyFoodSearchOrdering(
    builder: SelectQueryBuilder<Food>,
    query: FoodSearchQueryDto,
    hasQuery: boolean,
  ): void {
    if (!hasQuery && query.sortBy === undefined) {
      builder
        .orderBy('food.is_bestseller', DiscoverySortOrder.DESC)
        .addOrderBy('food.rating', DiscoverySortOrder.DESC)
        .addOrderBy('food.review_count', DiscoverySortOrder.DESC)
        .addOrderBy('food.name', DiscoverySortOrder.ASC)
        .addOrderBy('food.id', DiscoverySortOrder.ASC);
      return;
    }

    const requestedSortBy =
      query.sortBy === FoodSearchSortBy.RELEVANCE && !hasQuery
        ? FoodSearchSortBy.RATING
        : query.sortBy;
    const sortBy =
      requestedSortBy ??
      (hasQuery ? FoodSearchSortBy.RELEVANCE : FoodSearchSortBy.RATING);
    const sortOrder =
      query.sortOrder ??
      (sortBy === FoodSearchSortBy.RELEVANCE
        ? DiscoverySortOrder.ASC
        : DiscoverySortOrder.DESC);
    const sortColumns: Record<FoodSearchSortBy, string> = {
      [FoodSearchSortBy.RELEVANCE]: 'relevance',
      [FoodSearchSortBy.RATING]: 'food.rating',
      [FoodSearchSortBy.PRICE]: 'food.price_paise',
      [FoodSearchSortBy.PREPARATION_TIME]: 'food.preparation_minutes',
      [FoodSearchSortBy.NAME]: 'food.name',
      [FoodSearchSortBy.CREATED_AT]: 'food.created_at',
    };
    builder
      .orderBy(sortColumns[sortBy], sortOrder)
      .addOrderBy('food.id', DiscoverySortOrder.ASC);
  }

  private selectRestaurantCards(
    builder: SelectQueryBuilder<Restaurant>,
    query: Pick<RestaurantDiscoveryFilters, 'latitude' | 'longitude'>,
  ): void {
    builder.select([
      'restaurant.id AS restaurant_id',
      'restaurant.name AS restaurant_name',
      'restaurant.description AS restaurant_description',
      'restaurant.logo_url AS restaurant_image_url',
      'restaurant.banner_url AS restaurant_banner_url',
      'restaurant.city AS restaurant_city',
      'restaurant.rating AS restaurant_rating',
      'restaurant.review_count AS restaurant_review_count',
      'restaurant.average_delivery_minutes AS restaurant_delivery_time_minutes',
      'restaurant.delivery_fee_paise AS restaurant_delivery_fee_paise',
      'restaurant.minimum_order_paise AS restaurant_minimum_order_paise',
      'restaurant.is_pure_veg AS restaurant_is_pure_veg',
      'restaurant.is_open AS restaurant_is_open',
    ]);
    if (query.latitude !== undefined && query.longitude !== undefined) {
      this.addDistanceSelect(builder, 'restaurant');
    }
  }

  private selectFoodCards(builder: SelectQueryBuilder<Food>): void {
    builder.select([
      'food.id AS food_id',
      'food.restaurant_id AS food_restaurant_id',
      'restaurant.name AS restaurant_name',
      'food.category_id AS food_category_id',
      'category.name AS category_name',
      'food.name AS food_name',
      'food.description AS food_description',
      'food.image_url AS food_image_url',
      'food.price_paise AS food_price_paise',
      'food.original_price_paise AS food_original_price_paise',
      'food.rating AS food_rating',
      'food.review_count AS food_review_count',
      'food.preparation_minutes AS food_preparation_minutes',
      'food.is_veg AS food_is_veg',
      'food.is_bestseller AS food_is_bestseller',
      'food.is_available AS food_is_available',
      'restaurant.is_open AS restaurant_is_open',
      'restaurant.is_pure_veg AS restaurant_is_pure_veg',
    ]);
  }

  private addDistanceSelect<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
    alias: 'restaurant',
  ): void {
    builder.addSelect(
      `ST_Distance(${alias}.location, ${this.locationPointExpression()}) / 1000`,
      'distance_km',
    );
  }

  private locationPointExpression(): string {
    return 'ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography';
  }

  private excludeRestaurants(
    builder: SelectQueryBuilder<Restaurant>,
    excludeIds: string[],
  ): void {
    if (excludeIds.length > 0) {
      builder.andWhere('restaurant.id NOT IN (:...excludedRestaurantIds)', {
        excludedRestaurantIds: excludeIds,
      });
    }
  }

  private excludeFoods(
    builder: SelectQueryBuilder<Food>,
    excludeIds: string[],
  ): void {
    if (excludeIds.length > 0) {
      builder.andWhere('food.id NOT IN (:...excludedFoodIds)', {
        excludedFoodIds: excludeIds,
      });
    }
  }

  private async findRestaurantSuggestionRows(
    query: SearchSuggestionsQueryDto,
    limit: number,
  ): Promise<DiscoverySuggestionRecord[]> {
    const patterns = this.likePatterns(query.q);
    const builder = this.createPublicRestaurantQuery()
      .select([
        'restaurant.id AS id',
        'restaurant.name AS label',
        "'Restaurant' AS subtitle",
      ])
      .addSelect(
        "CASE WHEN restaurant.name ILIKE :suggestionPrefix ESCAPE '!' THEN 0 ELSE 1 END",
        'priority',
      )
      .andWhere("restaurant.name ILIKE :suggestionContains ESCAPE '!'", {
        suggestionPrefix: patterns.prefix,
        suggestionContains: patterns.contains,
      })
      .orderBy('priority', 'ASC')
      .addOrderBy('restaurant.name', 'ASC')
      .addOrderBy('restaurant.id', 'ASC')
      .take(limit);
    if (query.city) {
      builder.andWhere('LOWER(restaurant.city) = LOWER(:suggestionCity)', {
        suggestionCity: query.city.trim(),
      });
    }

    const rows = await this.getRawRows(builder);
    return rows.map((row) => ({
      type: 'restaurant',
      id: this.stringValue(row.id),
      label: this.stringValue(row.label),
      subtitle: this.stringValue(row.subtitle),
      priority: this.numberValue(row.priority),
    }));
  }

  private async findFoodSuggestionRows(
    query: SearchSuggestionsQueryDto,
    limit: number,
  ): Promise<DiscoverySuggestionRecord[]> {
    const patterns = this.likePatterns(query.q);
    const builder = this.createPublicFoodQuery()
      .select([
        'food.id AS id',
        'food.restaurant_id AS restaurant_id',
        'food.name AS label',
        'restaurant.name AS subtitle',
      ])
      .addSelect(
        "CASE WHEN food.name ILIKE :foodSuggestionPrefix ESCAPE '!' THEN 0 ELSE 1 END",
        'priority',
      )
      .andWhere("food.name ILIKE :foodSuggestionContains ESCAPE '!'", {
        foodSuggestionPrefix: patterns.prefix,
        foodSuggestionContains: patterns.contains,
      })
      .orderBy('priority', 'ASC')
      .addOrderBy('food.name', 'ASC')
      .addOrderBy('food.id', 'ASC')
      .take(limit);
    if (query.city) {
      builder.andWhere('LOWER(restaurant.city) = LOWER(:foodSuggestionCity)', {
        foodSuggestionCity: query.city.trim(),
      });
    }

    const rows = await this.getRawRows(builder);
    return rows.map((row) => ({
      type: 'food',
      id: this.stringValue(row.id),
      restaurantId: this.stringValue(row.restaurant_id),
      label: this.stringValue(row.label),
      subtitle: this.stringValue(row.subtitle),
      priority: this.numberValue(row.priority),
    }));
  }

  private likePatterns(query: string): { prefix: string; contains: string } {
    const escaped = query.replace(/[!%_]/g, '!$&');
    return { prefix: `${escaped}%`, contains: `%${escaped}%` };
  }

  private async getRawRows<T extends ObjectLiteral>(
    builder: SelectQueryBuilder<T>,
  ): Promise<Array<Record<string, unknown>>> {
    return await builder.getRawMany();
  }

  private mapRestaurantRows(
    rows: Array<Record<string, unknown>>,
  ): DiscoveryRestaurantRecord[] {
    return rows.map((row) => ({
      id: this.stringValue(row.restaurant_id),
      name: this.stringValue(row.restaurant_name),
      description: this.nullableString(row.restaurant_description),
      imageUrl: this.nullableString(row.restaurant_image_url),
      bannerUrl: this.nullableString(row.restaurant_banner_url),
      city: this.stringValue(row.restaurant_city),
      rating: this.numberValue(row.restaurant_rating),
      reviewCount: this.numberValue(row.restaurant_review_count),
      deliveryTimeMinutes: this.numberValue(
        row.restaurant_delivery_time_minutes,
      ),
      deliveryFeePaise: this.numberValue(row.restaurant_delivery_fee_paise),
      minimumOrderPaise: this.numberValue(row.restaurant_minimum_order_paise),
      isPureVeg: this.booleanValue(row.restaurant_is_pure_veg),
      isOpen: this.booleanValue(row.restaurant_is_open),
      distanceKm:
        row.distance_km === undefined || row.distance_km === null
          ? null
          : this.numberValue(row.distance_km),
    }));
  }

  private mapFoodRows(
    rows: Array<Record<string, unknown>>,
  ): DiscoveryFoodRecord[] {
    return rows.map((row) => ({
      id: this.stringValue(row.food_id),
      restaurantId: this.stringValue(row.food_restaurant_id),
      restaurantName: this.stringValue(row.restaurant_name),
      categoryId: this.nullableString(row.food_category_id),
      categoryName: this.nullableString(row.category_name),
      name: this.stringValue(row.food_name),
      description: this.nullableString(row.food_description),
      imageUrl: this.nullableString(row.food_image_url),
      pricePaise: this.numberValue(row.food_price_paise),
      originalPricePaise:
        row.food_original_price_paise === null
          ? null
          : this.numberValue(row.food_original_price_paise),
      rating: this.numberValue(row.food_rating),
      reviewCount: this.numberValue(row.food_review_count),
      preparationMinutes: this.numberValue(row.food_preparation_minutes),
      isVeg: this.booleanValue(row.food_is_veg),
      isBestseller: this.booleanValue(row.food_is_bestseller),
      isAvailable: this.booleanValue(row.food_is_available),
      restaurantIsOpen: this.booleanValue(row.restaurant_is_open),
      restaurantIsPureVeg: this.booleanValue(row.restaurant_is_pure_veg),
    }));
  }

  private stringValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return `${value}`;
    }
    return '';
  }

  private nullableString(value: unknown): string | null {
    return value === null || value === undefined
      ? null
      : this.stringValue(value);
  }

  private numberValue(value: unknown): number {
    return typeof value === 'number' ? value : Number(value);
  }

  private booleanValue(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
  }
}
