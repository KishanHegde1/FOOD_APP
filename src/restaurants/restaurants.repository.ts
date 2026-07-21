import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RestaurantQueryDto,
  RestaurantSortBy,
  SortOrder,
} from './dto/restaurant-query.dto';
import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';

export interface RestaurantListResult {
  items: Restaurant[];
  total: number;
}

@Injectable()
export class RestaurantsRepository {
  constructor(
    @InjectRepository(Restaurant)
    private readonly repository: Repository<Restaurant>,
  ) {}

  create(data: Partial<Restaurant>): Restaurant {
    return this.repository.create(data);
  }

  async save(restaurant: Restaurant): Promise<Restaurant> {
    return this.repository.save(restaurant);
  }

  async findPublicList(
    query: RestaurantQueryDto,
  ): Promise<RestaurantListResult> {
    const queryBuilder = this.repository
      .createQueryBuilder('restaurant')
      .where('restaurant.is_active = :isActive', { isActive: true })
      .andWhere('restaurant.status = :status', {
        status: RestaurantStatus.APPROVED,
      });

    const search = query.search?.trim();
    if (search) {
      queryBuilder.andWhere(
        '(restaurant.name ILIKE :search OR restaurant.description ILIKE :search OR restaurant.city ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const city = query.city?.trim();
    if (city) {
      queryBuilder.andWhere('restaurant.city ILIKE :city', {
        city: `%${city}%`,
      });
    }

    if (query.isPureVeg !== undefined) {
      queryBuilder.andWhere('restaurant.is_pure_veg = :isPureVeg', {
        isPureVeg: query.isPureVeg,
      });
    }

    if (query.isOpen !== undefined) {
      queryBuilder.andWhere('restaurant.is_open = :isOpen', {
        isOpen: query.isOpen,
      });
    }

    if (query.openNow === true) {
      queryBuilder.andWhere('restaurant.is_open = :openNow', {
        openNow: true,
      });
    }

    if (query.minimumRating !== undefined) {
      queryBuilder.andWhere('restaurant.rating >= :minimumRating', {
        minimumRating: query.minimumRating,
      });
    }

    if (query.maximumDeliveryMinutes !== undefined) {
      queryBuilder.andWhere(
        'restaurant.average_delivery_minutes <= :maximumDeliveryMinutes',
        { maximumDeliveryMinutes: query.maximumDeliveryMinutes },
      );
    }

    if (query.maximumDeliveryFeePaise !== undefined) {
      queryBuilder.andWhere(
        'restaurant.delivery_fee_paise <= :maximumDeliveryFeePaise',
        { maximumDeliveryFeePaise: query.maximumDeliveryFeePaise },
      );
    }

    if (query.radiusKm !== undefined) {
      queryBuilder
        .andWhere('restaurant.location IS NOT NULL')
        .andWhere(
          'ST_DWithin(restaurant.location, ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography, :radiusMeters)',
          {
            latitude: query.latitude,
            longitude: query.longitude,
            radiusMeters: query.radiusKm * 1000,
          },
        );
    }

    const sortColumn: Record<RestaurantSortBy, string> = {
      [RestaurantSortBy.NAME]: 'restaurant.name',
      [RestaurantSortBy.RATING]: 'restaurant.rating',
      [RestaurantSortBy.DELIVERY_TIME]: 'restaurant.average_delivery_minutes',
      [RestaurantSortBy.DELIVERY_FEE]: 'restaurant.delivery_fee_paise',
      [RestaurantSortBy.CREATED_AT]: 'restaurant.created_at',
    };
    const sortBy = query.sortBy ?? RestaurantSortBy.NAME;
    const sortOrder = query.sortOrder ?? SortOrder.ASC;

    queryBuilder
      .orderBy(sortColumn[sortBy], sortOrder)
      .addOrderBy('restaurant.id', SortOrder.ASC)
      .skip((query.page - 1) * query.limit)
      .take(query.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return { items, total };
  }

  async findPublicById(id: string): Promise<Restaurant | null> {
    return (
      (await this.repository
        .createQueryBuilder('restaurant')
        .where('restaurant.id = :id', { id })
        .andWhere('restaurant.is_active = :isActive', { isActive: true })
        .andWhere('restaurant.status = :status', {
          status: RestaurantStatus.APPROVED,
        })
        .getOne()) ?? null
    );
  }

  async findById(id: string): Promise<Restaurant | null> {
    return (await this.repository.findOne({ where: { id } })) ?? null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    return (await this.repository.findOne({ where: { slug } })) ?? null;
  }

  async findByOwnerId(ownerId: string): Promise<Restaurant[]> {
    return this.repository.find({
      where: { ownerId },
      order: { createdAt: 'DESC', id: 'ASC' },
    });
  }

  async findOwnedRestaurantById(
    id: string,
    ownerId: string,
  ): Promise<Restaurant | null> {
    return (await this.repository.findOne({ where: { id, ownerId } })) ?? null;
  }

  async updateById(
    id: string,
    data: Partial<Restaurant>,
  ): Promise<Restaurant | null> {
    const restaurant = await this.findById(id);
    if (!restaurant) {
      return null;
    }

    Object.assign(restaurant, data);
    return this.save(restaurant);
  }

  async existsByNameAndCity(name: string, city: string): Promise<boolean> {
    const total = await this.repository
      .createQueryBuilder('restaurant')
      .where('LOWER(restaurant.name) = LOWER(:name)', { name })
      .andWhere('LOWER(restaurant.city) = LOWER(:city)', { city })
      .getCount();

    return total > 0;
  }

  async countByOwner(ownerId: string): Promise<number> {
    return this.repository.count({ where: { ownerId } });
  }
}
