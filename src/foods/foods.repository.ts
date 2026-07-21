import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { FoodQueryDto, FoodSortBy, FoodSortOrder } from './dto/food-query.dto';
import { Food } from './entities/food.entity';
import { RestaurantStatus } from '../restaurants/entities/restaurant.entity';

export interface FoodListResult {
  items: Food[];
  total: number;
}

@Injectable()
export class FoodsRepository {
  constructor(
    @InjectRepository(Food)
    private readonly repository: Repository<Food>,
  ) {}

  create(data: Partial<Food>): Food {
    return this.repository.create(data);
  }

  async save(food: Food): Promise<Food> {
    return this.repository.save(food);
  }

  async findById(id: string): Promise<Food | null> {
    return (await this.repository.findOne({ where: { id } })) ?? null;
  }

  async findPublicById(id: string): Promise<Food | null> {
    return (
      (await this.repository
        .createQueryBuilder('food')
        .innerJoin('food.restaurant', 'restaurant')
        .where('food.id = :id', { id })
        .andWhere('food.is_active = :isActive', { isActive: true })
        .andWhere('restaurant.is_active = :restaurantIsActive', {
          restaurantIsActive: true,
        })
        .andWhere('restaurant.status = :status', {
          status: RestaurantStatus.APPROVED,
        })
        .getOne()) ?? null
    );
  }

  async findByRestaurantId(
    restaurantId: string,
    query: FoodQueryDto,
  ): Promise<FoodListResult> {
    const queryBuilder = this.repository
      .createQueryBuilder('food')
      .innerJoin('food.restaurant', 'restaurant')
      .leftJoin('food.category', 'category')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.is_active = :isActive', { isActive: true })
      .andWhere('restaurant.is_active = :restaurantIsActive', {
        restaurantIsActive: true,
      })
      .andWhere('restaurant.status = :status', {
        status: RestaurantStatus.APPROVED,
      })
      .andWhere(
        '(food.category_id IS NULL OR category.is_active = :categoryIsActive)',
        { categoryIsActive: true },
      );

    this.applyFilters(queryBuilder, query, query.isAvailable ?? true);
    this.applyOrdering(queryBuilder, query);
    queryBuilder.skip((query.page - 1) * query.limit).take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  async findByCategoryId(
    restaurantId: string,
    categoryId: string,
    query: FoodQueryDto,
  ): Promise<FoodListResult> {
    const queryBuilder = this.repository
      .createQueryBuilder('food')
      .innerJoin('food.restaurant', 'restaurant')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.category_id = :categoryId', { categoryId })
      .andWhere('food.is_active = :isActive', { isActive: true })
      .andWhere('restaurant.is_active = :restaurantIsActive', {
        restaurantIsActive: true,
      })
      .andWhere('restaurant.status = :status', {
        status: RestaurantStatus.APPROVED,
      });

    this.applyFilters(queryBuilder, query, query.isAvailable ?? true, false);
    this.applyOrdering(queryBuilder, query);
    queryBuilder.skip((query.page - 1) * query.limit).take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  async findManagementByRestaurantId(
    restaurantId: string,
    query: FoodQueryDto,
  ): Promise<FoodListResult> {
    const queryBuilder = this.repository
      .createQueryBuilder('food')
      .where('food.restaurant_id = :restaurantId', { restaurantId });

    this.applyFilters(queryBuilder, query);
    this.applyOrdering(queryBuilder, query);
    queryBuilder.skip((query.page - 1) * query.limit).take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  async findOwnedFoodById(
    foodId: string,
    ownerId: string,
  ): Promise<Food | null> {
    return (
      (await this.repository
        .createQueryBuilder('food')
        .innerJoin('food.restaurant', 'restaurant')
        .where('food.id = :foodId', { foodId })
        .andWhere('restaurant.owner_id = :ownerId', { ownerId })
        .getOne()) ?? null
    );
  }

  async findByNameInRestaurant(
    name: string,
    restaurantId: string,
  ): Promise<Food | null> {
    return (
      (await this.repository
        .createQueryBuilder('food')
        .where('food.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('food.is_active = :isActive', { isActive: true })
        .andWhere('LOWER(food.name) = LOWER(:name)', { name })
        .getOne()) ?? null
    );
  }

  async findActiveMenuByRestaurantId(restaurantId: string): Promise<Food[]> {
    return this.repository
      .createQueryBuilder('food')
      .innerJoin('food.restaurant', 'restaurant')
      .leftJoinAndSelect('food.category', 'category')
      .where('food.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('food.is_active = :isActive', { isActive: true })
      .andWhere('restaurant.is_active = :restaurantIsActive', {
        restaurantIsActive: true,
      })
      .andWhere('restaurant.status = :status', {
        status: RestaurantStatus.APPROVED,
      })
      .andWhere(
        '(food.category_id IS NULL OR category.is_active = :categoryIsActive)',
        { categoryIsActive: true },
      )
      .orderBy('category.sort_order', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .addOrderBy('food.sort_order', 'ASC')
      .addOrderBy('food.name', 'ASC')
      .addOrderBy('food.id', 'ASC')
      .getMany();
  }

  async updateById(id: string, data: Partial<Food>): Promise<Food | null> {
    const food = await this.findById(id);
    if (!food) {
      return null;
    }

    Object.assign(food, data);
    return this.save(food);
  }

  async countByRestaurantId(restaurantId: string): Promise<number> {
    return this.repository.count({ where: { restaurantId } });
  }

  private applyFilters(
    queryBuilder: SelectQueryBuilder<Food>,
    query: FoodQueryDto,
    defaultAvailability?: boolean,
    includeCategoryFilter = true,
  ): void {
    const search = query.search?.trim();
    if (search) {
      queryBuilder.andWhere(
        '(food.name ILIKE :search OR food.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (includeCategoryFilter && query.categoryId) {
      queryBuilder.andWhere('food.category_id = :filterCategoryId', {
        filterCategoryId: query.categoryId,
      });
    }
    if (query.isVeg !== undefined) {
      queryBuilder.andWhere('food.is_veg = :isVeg', { isVeg: query.isVeg });
    }
    if (query.isBestseller !== undefined) {
      queryBuilder.andWhere('food.is_bestseller = :isBestseller', {
        isBestseller: query.isBestseller,
      });
    }

    const availability = query.isAvailable ?? defaultAvailability;
    if (availability !== undefined) {
      queryBuilder.andWhere('food.is_available = :isAvailable', {
        isAvailable: availability,
      });
    }
    if (query.minimumRating !== undefined) {
      queryBuilder.andWhere('food.rating >= :minimumRating', {
        minimumRating: query.minimumRating,
      });
    }
    if (query.minimumPricePaise !== undefined) {
      queryBuilder.andWhere('food.price_paise >= :minimumPricePaise', {
        minimumPricePaise: query.minimumPricePaise,
      });
    }
    if (query.maximumPricePaise !== undefined) {
      queryBuilder.andWhere('food.price_paise <= :maximumPricePaise', {
        maximumPricePaise: query.maximumPricePaise,
      });
    }
  }

  private applyOrdering(
    queryBuilder: SelectQueryBuilder<Food>,
    query: FoodQueryDto,
  ): void {
    if (!query.sortBy) {
      queryBuilder
        .orderBy('food.is_bestseller', FoodSortOrder.DESC)
        .addOrderBy('food.sort_order', FoodSortOrder.ASC)
        .addOrderBy('food.name', FoodSortOrder.ASC)
        .addOrderBy('food.id', FoodSortOrder.ASC);
      return;
    }

    const sortColumns: Record<FoodSortBy, string> = {
      [FoodSortBy.NAME]: 'food.name',
      [FoodSortBy.PRICE]: 'food.price_paise',
      [FoodSortBy.RATING]: 'food.rating',
      [FoodSortBy.PREPARATION_TIME]: 'food.preparation_minutes',
      [FoodSortBy.SORT_ORDER]: 'food.sort_order',
      [FoodSortBy.CREATED_AT]: 'food.created_at',
    };
    queryBuilder
      .orderBy(sortColumns[query.sortBy], query.sortOrder)
      .addOrderBy('food.id', FoodSortOrder.ASC);
  }
}
