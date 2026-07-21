import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { MenuCategoryResponseDto } from './dto/menu-category-response.dto';
import { MenuCategoryOrderItemDto } from './dto/reorder-menu-categories.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuCategoriesRepository } from './menu-categories.repository';

@Injectable()
export class MenuCategoriesService {
  constructor(
    private readonly menuCategoriesRepository: MenuCategoriesRepository,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async findPublicByRestaurantId(
    restaurantId: string,
  ): Promise<MenuCategoryResponseDto[]> {
    await this.restaurantsService.findOnePublic(restaurantId);
    const categories =
      await this.menuCategoriesRepository.findPublicByRestaurantId(
        restaurantId,
      );

    return categories.map((category) =>
      MenuCategoryResponseDto.fromEntity(category),
    );
  }

  async findOne(id: string): Promise<MenuCategoryResponseDto> {
    const category = await this.menuCategoriesRepository.findById(id);
    if (!category || !category.isActive) {
      throw new NotFoundException('Menu category not found.');
    }

    await this.restaurantsService.findOnePublic(category.restaurantId);
    return MenuCategoryResponseDto.fromEntity(category);
  }

  async create(
    authenticatedUser: User,
    dto: CreateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    const restaurant = await this.restaurantsService.findOneForManagement(
      dto.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.ensureRestaurantIsActive(restaurant);

    const name = dto.name.trim();
    if (
      await this.menuCategoriesRepository.findByNameAndRestaurant(
        name,
        restaurant.id,
      )
    ) {
      throw new ConflictException(
        'A category with this name already exists for this restaurant.',
      );
    }

    const existingCategories =
      await this.menuCategoriesRepository.findByRestaurantId(restaurant.id);
    const sortOrder =
      dto.sortOrder ??
      existingCategories.reduce(
        (highest, category) => Math.max(highest, category.sortOrder),
        -1,
      ) + 1;
    const category = this.menuCategoriesRepository.create({
      restaurantId: restaurant.id,
      name,
      description: dto.description?.trim() || null,
      imageUrl: dto.imageUrl?.trim() || null,
      sortOrder,
      isActive: true,
    });

    return MenuCategoryResponseDto.fromEntity(
      await this.saveCategory(category),
    );
  }

  async update(
    authenticatedUser: User,
    id: string,
    dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    const category = await this.findCategoryForManagement(id);
    const restaurant = await this.restaurantsService.findOneForManagement(
      category.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const sameNameCategory =
        await this.menuCategoriesRepository.findByNameAndRestaurant(
          name,
          category.restaurantId,
        );
      if (sameNameCategory && sameNameCategory.id !== category.id) {
        throw new ConflictException(
          'A category with this name already exists for this restaurant.',
        );
      }
      category.name = name;
    }

    if (dto.description !== undefined)
      category.description = dto.description.trim() || null;
    if (dto.imageUrl !== undefined)
      category.imageUrl = dto.imageUrl.trim() || null;
    if (dto.sortOrder !== undefined) category.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) category.isActive = dto.isActive;

    return MenuCategoryResponseDto.fromEntity(
      await this.saveCategory(category),
    );
  }

  async deactivate(authenticatedUser: User, id: string): Promise<void> {
    const category = await this.findCategoryForManagement(id);
    const restaurant = await this.restaurantsService.findOneForManagement(
      category.restaurantId,
    );
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    category.isActive = false;
    await this.saveCategory(category);
  }

  async reorder(
    authenticatedUser: User,
    restaurantId: string,
    items: MenuCategoryOrderItemDto[],
  ): Promise<MenuCategoryResponseDto[]> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.ensureRestaurantIsActive(restaurant);

    const categories =
      await this.menuCategoriesRepository.findByIdsAndRestaurantId(
        items.map((item) => item.id),
        restaurantId,
      );
    if (categories.length !== items.length) {
      throw new BadRequestException(
        'Every category must belong to the specified restaurant.',
      );
    }

    const sortOrders = new Map(
      items.map((item) => [item.id, item.sortOrder] as const),
    );
    categories.forEach((category) => {
      category.sortOrder = sortOrders.get(category.id)!;
    });

    const updatedCategories = await this.saveCategories(categories);
    return updatedCategories
      .sort((first, second) => first.sortOrder - second.sortOrder)
      .map((category) => MenuCategoryResponseDto.fromEntity(category));
  }

  private async findCategoryForManagement(id: string): Promise<MenuCategory> {
    const category = await this.menuCategoriesRepository.findById(id);
    if (!category) {
      throw new NotFoundException('Menu category not found.');
    }
    return category;
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
        'Only restaurant owners and administrators can manage menu categories.',
      );
    }
    if (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this restaurant.');
    }
  }

  private ensureRestaurantIsActive(restaurant: Restaurant): void {
    if (!restaurant.isActive) {
      throw new ConflictException(
        'Inactive restaurants cannot manage categories.',
      );
    }
  }

  private async saveCategory(category: MenuCategory): Promise<MenuCategory> {
    try {
      return await this.menuCategoriesRepository.save(category);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException(
          'A category with this name already exists for this restaurant.',
        );
      }
      throw new InternalServerErrorException('Unable to save menu category.');
    }
  }

  private async saveCategories(
    categories: MenuCategory[],
  ): Promise<MenuCategory[]> {
    try {
      return await this.menuCategoriesRepository.saveMany(categories);
    } catch {
      throw new InternalServerErrorException(
        'Unable to reorder menu categories.',
      );
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
