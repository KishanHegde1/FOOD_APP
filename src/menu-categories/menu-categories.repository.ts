import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MenuCategory } from './entities/menu-category.entity';

@Injectable()
export class MenuCategoriesRepository {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly repository: Repository<MenuCategory>,
  ) {}

  create(data: Partial<MenuCategory>): MenuCategory {
    return this.repository.create(data);
  }

  async save(category: MenuCategory): Promise<MenuCategory> {
    return this.repository.save(category);
  }

  async saveMany(categories: MenuCategory[]): Promise<MenuCategory[]> {
    return this.repository.manager.transaction(async (manager) =>
      manager.save(MenuCategory, categories),
    );
  }

  async findPublicByRestaurantId(
    restaurantId: string,
  ): Promise<MenuCategory[]> {
    return this.repository.find({
      where: { restaurantId, isActive: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: string): Promise<MenuCategory | null> {
    return (await this.repository.findOne({ where: { id } })) ?? null;
  }

  async findByRestaurantId(restaurantId: string): Promise<MenuCategory[]> {
    return this.repository.find({
      where: { restaurantId },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOwnedCategoryById(
    id: string,
    ownerId: string,
  ): Promise<MenuCategory | null> {
    return (
      (await this.repository
        .createQueryBuilder('category')
        .innerJoin('category.restaurant', 'restaurant')
        .where('category.id = :id', { id })
        .andWhere('restaurant.owner_id = :ownerId', { ownerId })
        .getOne()) ?? null
    );
  }

  async findByNameAndRestaurant(
    name: string,
    restaurantId: string,
  ): Promise<MenuCategory | null> {
    return (
      (await this.repository
        .createQueryBuilder('category')
        .where('category.restaurant_id = :restaurantId', { restaurantId })
        .andWhere('LOWER(category.name) = LOWER(:name)', { name })
        .getOne()) ?? null
    );
  }

  async findByIdsAndRestaurantId(
    ids: string[],
    restaurantId: string,
  ): Promise<MenuCategory[]> {
    return this.repository.find({
      where: { id: In(ids), restaurantId },
    });
  }

  async updateById(
    id: string,
    data: Partial<MenuCategory>,
  ): Promise<MenuCategory | null> {
    const category = await this.findById(id);
    if (!category) {
      return null;
    }

    Object.assign(category, data);
    return this.save(category);
  }
}
