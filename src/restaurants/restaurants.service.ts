import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PaginatedRestaurantsResponseDto } from './dto/paginated-restaurants-response.dto';
import { RestaurantQueryDto } from './dto/restaurant-query.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { Restaurant, RestaurantStatus } from './entities/restaurant.entity';
import { RestaurantsRepository } from './restaurants.repository';

@Injectable()
export class RestaurantsService {
  constructor(private readonly restaurantsRepository: RestaurantsRepository) {}

  async findAllPublic(
    query: RestaurantQueryDto,
  ): Promise<PaginatedRestaurantsResponseDto> {
    this.validateLocation(query);
    const { items, total } =
      await this.restaurantsRepository.findPublicList(query);

    return {
      items: items.map((restaurant) =>
        RestaurantResponseDto.fromEntity(restaurant),
      ),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findOnePublic(id: string): Promise<RestaurantResponseDto> {
    const restaurant = await this.restaurantsRepository.findPublicById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    return RestaurantResponseDto.fromEntity(restaurant);
  }

  async findOneForManagement(id: string): Promise<Restaurant> {
    const restaurant = await this.restaurantsRepository.findById(id);
    if (!restaurant) {
      throw new NotFoundException('Restaurant not found.');
    }

    return restaurant;
  }

  async createForOwner(
    authenticatedUser: User,
    dto: CreateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    this.ensureRestaurantManager(authenticatedUser);

    const name = dto.name.trim();
    const city = dto.city.trim();
    if (await this.restaurantsRepository.existsByNameAndCity(name, city)) {
      throw new ConflictException(
        'A restaurant with this name already exists in the selected city.',
      );
    }

    const restaurant = this.restaurantsRepository.create({
      ownerId: authenticatedUser.id,
      name,
      slug: await this.generateUniqueSlug(name, city),
      description: dto.description?.trim() || null,
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim().toLowerCase() || null,
      logoUrl: dto.logoUrl?.trim() || null,
      bannerUrl: dto.bannerUrl?.trim() || null,
      addressLine: dto.addressLine.trim(),
      locality: dto.locality?.trim() || null,
      city,
      state: dto.state?.trim() || null,
      postalCode: dto.postalCode?.trim() || null,
      country: dto.country?.trim() || 'India',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      rating: 0,
      reviewCount: 0,
      averageDeliveryMinutes: dto.averageDeliveryMinutes ?? 30,
      deliveryFeePaise: dto.deliveryFeePaise ?? 0,
      minimumOrderPaise: dto.minimumOrderPaise ?? 0,
      serviceRadiusKm: dto.serviceRadiusKm ?? 5,
      isOpen: false,
      isActive: true,
      isPureVeg: dto.isPureVeg ?? false,
      status: RestaurantStatus.PENDING,
      openingTime: dto.openingTime?.trim() || null,
      closingTime: dto.closingTime?.trim() || null,
    });

    return RestaurantResponseDto.fromEntity(
      await this.saveRestaurant(restaurant),
    );
  }

  async findOwnedRestaurants(
    authenticatedUser: User,
  ): Promise<RestaurantResponseDto[]> {
    this.ensureRestaurantManager(authenticatedUser);
    const restaurants = await this.restaurantsRepository.findByOwnerId(
      authenticatedUser.id,
    );

    return restaurants.map((restaurant) =>
      RestaurantResponseDto.fromEntity(restaurant),
    );
  }

  async updateOwnedRestaurant(
    authenticatedUser: User,
    id: string,
    dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.findOneForManagement(id);
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    this.applyEditableFields(restaurant, dto);

    return RestaurantResponseDto.fromEntity(
      await this.saveRestaurant(restaurant),
    );
  }

  async deactivateOwnedRestaurant(
    authenticatedUser: User,
    id: string,
  ): Promise<void> {
    const restaurant = await this.findOneForManagement(id);
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);
    restaurant.isActive = false;
    restaurant.isOpen = false;
    await this.saveRestaurant(restaurant);
  }

  async setOpenStatus(
    authenticatedUser: User,
    id: string,
    isOpen: boolean,
  ): Promise<RestaurantResponseDto> {
    const restaurant = await this.findOneForManagement(id);
    this.ensureCanManageRestaurant(authenticatedUser, restaurant);

    if (
      isOpen &&
      (!restaurant.isActive || restaurant.status === RestaurantStatus.SUSPENDED)
    ) {
      throw new ConflictException(
        'An inactive or suspended restaurant cannot be opened.',
      );
    }

    restaurant.isOpen = isOpen;
    return RestaurantResponseDto.fromEntity(
      await this.saveRestaurant(restaurant),
    );
  }

  async approveRestaurant(id: string): Promise<Restaurant> {
    return this.setStatus(id, RestaurantStatus.APPROVED, true);
  }

  async rejectRestaurant(id: string): Promise<Restaurant> {
    return this.setStatus(id, RestaurantStatus.REJECTED, false);
  }

  async suspendRestaurant(id: string): Promise<Restaurant> {
    const restaurant = await this.findOneForManagement(id);
    restaurant.status = RestaurantStatus.SUSPENDED;
    restaurant.isOpen = false;
    return this.saveRestaurant(restaurant);
  }

  async reactivateRestaurant(id: string): Promise<Restaurant> {
    return this.setStatus(id, RestaurantStatus.APPROVED, true);
  }

  private ensureRestaurantManager(user: User): void {
    if (!user.isActive) {
      throw new ForbiddenException('This user account is inactive.');
    }

    if (
      user.role !== UserRole.RESTAURANT_OWNER &&
      user.role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'Only restaurant owners and administrators can manage restaurants.',
      );
    }
  }

  private validateLocation(query: RestaurantQueryDto): void {
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

  private ensureCanManageRestaurant(user: User, restaurant: Restaurant): void {
    this.ensureRestaurantManager(user);
    if (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id) {
      throw new ForbiddenException('You do not own this restaurant.');
    }
  }

  private applyEditableFields(
    restaurant: Restaurant,
    dto: UpdateRestaurantDto,
  ): void {
    if (dto.name !== undefined) restaurant.name = dto.name.trim();
    if (dto.description !== undefined)
      restaurant.description = dto.description.trim() || null;
    if (dto.phone !== undefined) restaurant.phone = dto.phone.trim() || null;
    if (dto.email !== undefined)
      restaurant.email = dto.email.trim().toLowerCase() || null;
    if (dto.logoUrl !== undefined)
      restaurant.logoUrl = dto.logoUrl.trim() || null;
    if (dto.bannerUrl !== undefined)
      restaurant.bannerUrl = dto.bannerUrl.trim() || null;
    if (dto.addressLine !== undefined)
      restaurant.addressLine = dto.addressLine.trim();
    if (dto.locality !== undefined)
      restaurant.locality = dto.locality.trim() || null;
    if (dto.city !== undefined) restaurant.city = dto.city.trim();
    if (dto.state !== undefined) restaurant.state = dto.state.trim() || null;
    if (dto.postalCode !== undefined)
      restaurant.postalCode = dto.postalCode.trim() || null;
    if (dto.country !== undefined) restaurant.country = dto.country.trim();
    if (dto.latitude !== undefined) restaurant.latitude = dto.latitude;
    if (dto.longitude !== undefined) restaurant.longitude = dto.longitude;
    if (dto.averageDeliveryMinutes !== undefined)
      restaurant.averageDeliveryMinutes = dto.averageDeliveryMinutes;
    if (dto.deliveryFeePaise !== undefined)
      restaurant.deliveryFeePaise = dto.deliveryFeePaise;
    if (dto.minimumOrderPaise !== undefined)
      restaurant.minimumOrderPaise = dto.minimumOrderPaise;
    if (dto.serviceRadiusKm !== undefined)
      restaurant.serviceRadiusKm = dto.serviceRadiusKm;
    if (dto.isPureVeg !== undefined) restaurant.isPureVeg = dto.isPureVeg;
    if (dto.openingTime !== undefined)
      restaurant.openingTime = dto.openingTime.trim() || null;
    if (dto.closingTime !== undefined)
      restaurant.closingTime = dto.closingTime.trim() || null;
  }

  private async generateUniqueSlug(
    name: string,
    city: string,
  ): Promise<string> {
    const baseSlug =
      `${name}-${city}`
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 220) || 'restaurant';

    for (let index = 0; index < 100; index += 1) {
      const suffix = index === 0 ? '' : `-${index + 1}`;
      const candidate = `${baseSlug.slice(0, 220 - suffix.length)}${suffix}`;
      if (!(await this.restaurantsRepository.findBySlug(candidate))) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to generate a unique restaurant slug.');
  }

  private async setStatus(
    id: string,
    status: RestaurantStatus,
    isActive: boolean,
  ): Promise<Restaurant> {
    const restaurant = await this.findOneForManagement(id);
    restaurant.status = status;
    restaurant.isActive = isActive;
    if (!isActive) {
      restaurant.isOpen = false;
    }
    return this.saveRestaurant(restaurant);
  }

  private async saveRestaurant(restaurant: Restaurant): Promise<Restaurant> {
    try {
      return await this.restaurantsRepository.save(restaurant);
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) {
        throw new ConflictException('Restaurant slug already exists.');
      }
      throw new InternalServerErrorException('Unable to save restaurant.');
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
