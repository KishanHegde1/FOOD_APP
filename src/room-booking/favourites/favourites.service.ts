import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelFavourite } from './entities/hotel-favourite.entity';

export type FavouriteResponse = {
  hotelId: string;
  isFavourite: boolean;
};

@Injectable()
export class FavouritesService {
  constructor(
    @InjectRepository(HotelFavourite)
    private readonly favouritesRepository: Repository<HotelFavourite>,
    @InjectRepository(Hotel)
    private readonly hotelsRepository: Repository<Hotel>,
  ) {}

  async add(user: User, hotelId: string): Promise<FavouriteResponse> {
    const hotel = await this.hotelsRepository.findOne({
      where: { id: hotelId, isActive: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const existing = await this.favouritesRepository.findOne({
      where: { userId: user.id, hotelId },
    });
    if (!existing) {
      try {
        await this.favouritesRepository.save(
          this.favouritesRepository.create({ userId: user.id, hotelId }),
        );
      } catch (error) {
        if (!this.isUniqueViolation(error)) throw error;
      }
    }
    return { hotelId, isFavourite: true };
  }

  async remove(user: User, hotelId: string): Promise<FavouriteResponse> {
    await this.favouritesRepository.delete({ userId: user.id, hotelId });
    return { hotelId, isFavourite: false };
  }

  async list(user: User): Promise<Array<Record<string, unknown>>> {
    const favourites = await this.favouritesRepository
      .createQueryBuilder('favourite')
      .innerJoinAndSelect('favourite.hotel', 'hotel', 'hotel.is_active = true')
      .leftJoinAndSelect('hotel.images', 'image')
      .where('favourite.user_id = :userId', { userId: user.id })
      .orderBy('favourite.created_at', 'DESC')
      .getMany();

    return favourites.map((favourite) => {
      const hotel = favourite.hotel;
      const images = (hotel.images ?? [])
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);
      return {
        id: hotel.id,
        name: hotel.name,
        hotelType: hotel.hotelType,
        city: hotel.city,
        state: hotel.state,
        country: hotel.country,
        starRating: hotel.starRating,
        averageRating: Number(hotel.averageRating),
        reviewCount: hotel.reviewCount,
        primaryImage:
          images.find((image) => image.isPrimary)?.imageUrl ??
          images[0]?.imageUrl ??
          null,
        favouritedAt: favourite.createdAt.toISOString(),
      };
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}
