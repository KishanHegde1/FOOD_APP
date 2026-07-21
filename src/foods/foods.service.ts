import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { MenuCategoriesRepository } from '../menu-categories/menu-categories.repository';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodQueryDto } from './dto/food-query.dto';
import { FoodResponseDto } from './dto/food-response.dto';
import { PaginatedFoodsResponseDto } from './dto/paginated-foods-response.dto';
import {
  RestaurantMenuCategoryResponseDto,
  RestaurantMenuResponseDto,
} from './dto/restaurant-menu-response.dto';
import { UpdateFoodAvailabilityDto } from './dto/update-food-availability.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { Food } from './entities/food.entity';
import { FoodsRepository } from './foods.repository';

@Injectable()
export class FoodsService {
  constructor(
    private readonly foodsRepository: FoodsRepository,
    private readonly restaurantsService: RestaurantsService,
    private readonly menuCategoriesRepository: MenuCategoriesRepository,
  ) {}

  async findRestaurantFoods(
    restaurantId: string,
    query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    await this.restaurantsService.findOnePublic(restaurantId);
    this.ensureValidPriceRange(query);
    const { items, total } = await this.foodsRepository.findByRestaurantId(
      restaurantId,
      query,
    );

    return this.toPaginatedResponse(items, query, total);
  }

  async findRestaurantMenu(
    restaurantId: string,
  ): Promise<RestaurantMenuResponseDto> {
    await this.restaurantsService.findOnePublic(restaurantId);
    const [menuCategories, foods] = await Promise.all([
      this.menuCategoriesRepository.findPublicByRestaurantId(restaurantId),
      this.foodsRepository.findActiveMenuByRestaurantId(restaurantId),
    ]);
    const categories = new Map<string, RestaurantMenuCategoryResponseDto>(
      menuCategories.map((category) => [
        category.id,
        {
          id: category.id,
          name: category.name,
          description: category.description,
          imageUrl: category.imageUrl,
          sortOrder: category.sortOrder,
          items: [],
        },
      ]),
    );
    const uncategorizedItems: FoodResponseDto[] = [];

    for (const food of foods) {
      const response = FoodResponseDto.fromEntity(food);
      if (!food.categoryId || !food.category) {
        uncategorizedItems.push(response);
        continue;
      }

      categories.get(food.category.id)?.items.push(response);
    }

    return {
      restaurantId,
      categories: [...categories.values()],
      uncategorizedItems,
    };
  }

  async findFoodsByCategory(
    restaurantId: string,
    categoryId: string,
    query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    await this.restaurantsService.findOnePublic(restaurantId);
    const category = await this.menuCategoriesRepository.findById(categoryId);
    if (
      !category ||
      !category.isActive ||
      category.restaurantId !== restaurantId
    ) {
      throw new NotFoundException('Menu category not found.');
    }

    this.ensureValidPriceRange(query);
    const { items, total } = await this.foodsRepository.findByCategoryId(
      restaurantId,
      categoryId,
      query,
    );
    return this.toPaginatedResponse(items, query, total);
  }

  async findOnePublic(foodId: string): Promise<FoodResponseDto> {
    const food = await this.foodsRepository.findPublicById(foodId);
    if (!food) {
      throw new NotFoundException('Food item not found.');
    }

    return FoodResponseDto.fromEntity(food);
  }

  async createForRestaurant(
    authenticatedUser: User,
    dto: CreateFoodDto,
  ): Promise<FoodResponseDto> {
    const restaurant = await this.restaurantsService.findOneForManagement(
      dto.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.ensureRestaurantIsActive(restaurant);
    await this.ensureValidCategory(dto.categoryId, restaurant.id);
    this.ensurePriceRelationship(dto.pricePaise, dto.originalPricePaise);
    this.ensurePureVegCompatibility(restaurant, dto.isVeg);

    const name = dto.name.trim();
    const duplicateFood = await this.foodsRepository.findByNameInRestaurant(
      name,
      restaurant.id,
    );
    if (duplicateFood) {
      throw new ConflictException(
        'An active food item with this name already exists for this restaurant.',
      );
    }

    const food = this.foodsRepository.create({
      restaurantId: restaurant.id,
      categoryId: dto.categoryId ?? null,
      name,
      description: this.toNullableText(dto.description),
      imageUrl: this.toNullableText(dto.imageUrl),
      pricePaise: dto.pricePaise,
      originalPricePaise: dto.originalPricePaise ?? null,
      rating: 0,
      reviewCount: 0,
      preparationMinutes: dto.preparationMinutes ?? 15,
      isVeg: dto.isVeg,
      isBestseller: dto.isBestseller ?? false,
      isAvailable: true,
      isActive: true,
      sortOrder: dto.sortOrder ?? 0,
    });

    return FoodResponseDto.fromEntity(await this.saveFood(food));
  }

  async updateOwnedFood(
    authenticatedUser: User,
    foodId: string,
    dto: UpdateFoodDto,
  ): Promise<FoodResponseDto> {
    const food = await this.findFoodForManagement(foodId);
    const restaurant = await this.restaurantsService.findOneForManagement(
      food.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.ensureRestaurantIsActive(restaurant);

    if (dto.categoryId !== undefined) {
      await this.ensureValidCategory(dto.categoryId, restaurant.id);
    }

    const name = dto.name?.trim();
    if (name && name !== food.name) {
      const duplicateFood = await this.foodsRepository.findByNameInRestaurant(
        name,
        restaurant.id,
      );
      if (duplicateFood && duplicateFood.id !== food.id) {
        throw new ConflictException(
          'An active food item with this name already exists for this restaurant.',
        );
      }
    }

    const pricePaise = dto.pricePaise ?? food.pricePaise;
    const originalPricePaise =
      dto.originalPricePaise !== undefined
        ? dto.originalPricePaise
        : food.originalPricePaise;
    this.ensurePriceRelationship(pricePaise, originalPricePaise);
    this.ensurePureVegCompatibility(restaurant, dto.isVeg ?? food.isVeg);

    if (dto.categoryId !== undefined) food.categoryId = dto.categoryId;
    if (name !== undefined) food.name = name;
    if (dto.description !== undefined)
      food.description = this.toNullableText(dto.description);
    if (dto.imageUrl !== undefined)
      food.imageUrl = this.toNullableText(dto.imageUrl);
    if (dto.pricePaise !== undefined) food.pricePaise = dto.pricePaise;
    if (dto.originalPricePaise !== undefined)
      food.originalPricePaise = dto.originalPricePaise;
    if (dto.preparationMinutes !== undefined)
      food.preparationMinutes = dto.preparationMinutes;
    if (dto.isVeg !== undefined) food.isVeg = dto.isVeg;
    if (dto.isBestseller !== undefined) food.isBestseller = dto.isBestseller;
    if (dto.sortOrder !== undefined) food.sortOrder = dto.sortOrder;

    return FoodResponseDto.fromEntity(await this.saveFood(food));
  }

  async updateAvailability(
    authenticatedUser: User,
    foodId: string,
    dto: UpdateFoodAvailabilityDto,
  ): Promise<FoodResponseDto> {
    const food = await this.findFoodForManagement(foodId);
    const restaurant = await this.restaurantsService.findOneForManagement(
      food.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);

    if (
      dto.isAvailable &&
      (!food.isActive ||
        !restaurant.isActive ||
        restaurant.status === RestaurantStatus.SUSPENDED)
    ) {
      throw new ConflictException(
        'Unavailable restaurant or inactive food items cannot be made available.',
      );
    }

    food.isAvailable = dto.isAvailable;
    return FoodResponseDto.fromEntity(await this.saveFood(food));
  }

  async deactivateOwnedFood(
    authenticatedUser: User,
    foodId: string,
  ): Promise<void> {
    const food = await this.findFoodForManagement(foodId);
    const restaurant = await this.restaurantsService.findOneForManagement(
      food.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);

    food.isActive = false;
    food.isAvailable = false;
    await this.saveFood(food);
  }

  async findOwnedFoods(
    authenticatedUser: User,
    restaurantId: string,
    query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.ensureValidPriceRange(query);
    const { items, total } =
      await this.foodsRepository.findManagementByRestaurantId(
        restaurantId,
        query,
      );

    return this.toPaginatedResponse(items, query, total);
  }

  private toPaginatedResponse(
    items: Food[],
    query: FoodQueryDto,
    total: number,
  ): PaginatedFoodsResponseDto {
    return {
      items: items.map((food) => FoodResponseDto.fromEntity(food)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  private async findFoodForManagement(foodId: string): Promise<Food> {
    const food = await this.foodsRepository.findById(foodId);
    if (!food) {
      throw new NotFoundException('Food item not found.');
    }
    return food;
  }

  private ensureCanManageRestaurant(user: User, restaurant: Restaurant): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }
    if (
      user.role !== UserRole.RESTAURANT_OWNER &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only restaurant owners and administrators can manage food items.',
      );
    }
    if (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this restaurant.');
    }
  }

  private ensureRestaurantIsActive(restaurant: Restaurant): void {
    if (!restaurant.isActive) {
      throw new ConflictException(
        'Inactive restaurants cannot manage food items.',
      );
    }
  }

  private async ensureValidCategory(
    categoryId: string | null | undefined,
    restaurantId: string,
  ): Promise<void> {
    if (categoryId === undefined || categoryId === null) {
      return;
    }

    const category = await this.menuCategoriesRepository.findById(categoryId);
    if (!category) {
      throw new NotFoundException('Menu category not found.');
    }
    if (category.restaurantId !== restaurantId) {
      throw new BadRequestException(
        'Menu category must belong to the selected restaurant.',
      );
    }
  }

  private ensurePriceRelationship(
    pricePaise: number,
    originalPricePaise: number | null | undefined,
  ): void {
    if (
      originalPricePaise !== undefined &&
      originalPricePaise !== null &&
      originalPricePaise < pricePaise
    ) {
      throw new BadRequestException(
        'originalPricePaise must be greater than or equal to pricePaise.',
      );
    }
  }

  private ensureValidPriceRange(query: FoodQueryDto): void {
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

  private ensurePureVegCompatibility(
    restaurant: Restaurant,
    isVeg: boolean,
  ): void {
    if (restaurant.isPureVeg && !isVeg) {
      throw new BadRequestException(
        'Non-vegetarian items cannot be added to a pure-veg restaurant.',
      );
    }
  }

  private toNullableText(value: string | null | undefined): string | null {
    return value?.trim() || null;
  }

  private async saveFood(food: Food): Promise<Food> {
    try {
      return await this.foodsRepository.save(food);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'An active food item with this name already exists for this restaurant.',
        );
      }
      throw new InternalServerErrorException('Unable to save food item.');
    }
  }

  private isUniqueConstraintViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
