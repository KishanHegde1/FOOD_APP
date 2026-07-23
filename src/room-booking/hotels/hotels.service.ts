import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  HotelBookingStatus,
  HotelSortBy,
} from '../common/enums/room-booking.enums';
import { assertValidStay } from '../common/utils/stay-dates.util';
import { toRoomSummary } from '../rooms/rooms.service';
import { SearchHotelsDto } from './dto/search-hotels.dto';
import {
  HotelAmenityResponseDto,
  HotelDetailResponseDto,
  HotelImageResponseDto,
  HotelSummaryResponseDto,
  PaginatedHotelsResponseDto,
  PopularDestinationResponseDto,
} from './dto/hotel-response.dto';
import { HotelImage } from './entities/hotel-image.entity';
import { Hotel } from './entities/hotel.entity';

@Injectable()
export class HotelsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelsRepository: Repository<Hotel>,
    @InjectRepository(HotelImage)
    private readonly hotelImagesRepository: Repository<HotelImage>,
  ) {}

  async findFeatured(): Promise<HotelSummaryResponseDto[]> {
    const hotels = await this.hotelsRepository
      .createQueryBuilder('hotel')
      .where('hotel.is_active = true')
      .andWhere(this.hasActiveRoomClause())
      .orderBy('hotel.average_rating', 'DESC')
      .addOrderBy('hotel.review_count', 'DESC')
      .addOrderBy('hotel.id', 'ASC')
      .take(12)
      .getMany();
    return this.toSummaries(
      await this.hydrateHotels(hotels.map((hotel) => hotel.id)),
    );
  }

  /**
   * Popular ranking is deterministic: active featured hotels first, followed
   * by confirmed/check-in/check-out booking count, average rating, review
   * count, and hotel ID as the final stable tiebreaker.
   */
  async findPopular(): Promise<HotelSummaryResponseDto[]> {
    const rawRows = await this.hotelsRepository
      .createQueryBuilder('hotel')
      .select('hotel.id', 'id')
      .leftJoin(
        'hotel.bookings',
        'booking',
        'booking.booking_status IN (:...bookingStatuses)',
        {
          bookingStatuses: [
            HotelBookingStatus.CONFIRMED,
            HotelBookingStatus.CHECKED_IN,
            HotelBookingStatus.CHECKED_OUT,
          ],
        },
      )
      .where('hotel.is_active = true')
      .andWhere(this.hasActiveRoomClause())
      .groupBy('hotel.id')
      .orderBy('hotel.is_featured', 'DESC')
      .addOrderBy('COUNT(booking.id)', 'DESC')
      .addOrderBy('hotel.average_rating', 'DESC')
      .addOrderBy('hotel.review_count', 'DESC')
      .addOrderBy('hotel.id', 'ASC')
      .take(12)
      .getRawMany<{ id: string }>();
    return this.toSummaries(
      await this.hydrateHotels(rawRows.map((row) => row.id)),
    );
  }

  async findPopularDestinations(): Promise<PopularDestinationResponseDto[]> {
    const rows = await this.hotelsRepository
      .createQueryBuilder('hotel')
      .select('hotel.city', 'city')
      .addSelect('hotel.state', 'state')
      .addSelect('hotel.country', 'country')
      .addSelect('COUNT(hotel.id)', 'activeHotelCount')
      .where('hotel.is_active = true')
      .andWhere(this.hasActiveRoomClause())
      .groupBy('hotel.city')
      .addGroupBy('hotel.state')
      .addGroupBy('hotel.country')
      .orderBy('COUNT(hotel.id)', 'DESC')
      .addOrderBy('hotel.city', 'ASC')
      .take(12)
      .getRawMany<{
        city: string;
        state: string | null;
        country: string;
        activeHotelCount: string;
      }>();

    return Promise.all(
      rows.map(async (row) => ({
        city: row.city,
        state: row.state,
        country: row.country,
        activeHotelCount: Number(row.activeHotelCount),
        primaryImage: await this.findDestinationPrimaryImage(
          row.city,
          row.state,
          row.country,
        ),
      })),
    );
  }

  async search(query: SearchHotelsDto): Promise<PaginatedHotelsResponseDto> {
    this.validateSearch(query);
    const queryBuilder = this.hotelsRepository
      .createQueryBuilder('hotel')
      .where('hotel.is_active = true')
      .andWhere(this.hasActiveRoomClause());

    const destination = query.destination?.trim();
    if (destination) {
      queryBuilder.andWhere(
        '(hotel.name ILIKE :destination OR hotel.locality ILIKE :destination OR hotel.city ILIKE :destination)',
        { destination: `%${destination}%` },
      );
    }
    if (query.city?.trim()) {
      queryBuilder.andWhere('hotel.city ILIKE :city', {
        city: `%${query.city.trim()}%`,
      });
    }
    if (query.minimumRating !== undefined) {
      queryBuilder.andWhere('hotel.average_rating >= :minimumRating', {
        minimumRating: query.minimumRating,
      });
    }
    if (query.hotelType) {
      queryBuilder.andWhere('hotel.hotel_type = :hotelType', {
        hotelType: query.hotelType,
      });
    }
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const priceClauses = [
        'priced_room.hotel_id = hotel.id',
        'priced_room.is_active = true',
      ];
      if (query.minPrice !== undefined)
        priceClauses.push('priced_room.base_price >= :minPrice');
      if (query.maxPrice !== undefined)
        priceClauses.push('priced_room.base_price <= :maxPrice');
      queryBuilder.andWhere(
        `EXISTS (SELECT 1 FROM hotel_rooms priced_room WHERE ${priceClauses.join(' AND ')})`,
        { minPrice: query.minPrice, maxPrice: query.maxPrice },
      );
    }
    if (query.amenities?.length) {
      queryBuilder.andWhere(
        `(
          SELECT COUNT(DISTINCT amenity_link.amenity_id)
          FROM hotel_amenity_links amenity_link
          INNER JOIN hotel_amenities amenity ON amenity.id = amenity_link.amenity_id
          WHERE amenity_link.hotel_id = hotel.id
            AND amenity.is_active = true
            AND amenity_link.amenity_id IN (:...amenities)
        ) = :amenityCount`,
        { amenities: query.amenities, amenityCount: query.amenities.length },
      );
    }

    if (query.checkIn && query.checkOut) {
      const stay = assertValidStay(query.checkIn, query.checkOut);
      queryBuilder.andWhere(
        `EXISTS (
          SELECT 1
          FROM hotel_rooms availability_room
          WHERE availability_room.hotel_id = hotel.id
            AND availability_room.is_active = true
            AND availability_room.max_adults >= :adults
            AND availability_room.max_children >= :children
            AND (
              SELECT COUNT(*)
              FROM room_inventory inventory
              WHERE inventory.room_id = availability_room.id
                AND inventory.inventory_date >= :checkIn
                AND inventory.inventory_date < :checkOut
                AND inventory.total_inventory - inventory.reserved_inventory - inventory.blocked_inventory >= :requestedRooms
            ) = :numberOfNights
        )`,
        {
          adults: query.adults,
          children: query.children,
          requestedRooms: query.rooms,
          numberOfNights: stay.nights,
          checkIn: query.checkIn,
          checkOut: query.checkOut,
        },
      );
    }

    this.applySort(queryBuilder, query.sortBy);
    queryBuilder.skip((query.page - 1) * query.limit).take(query.limit);
    const [hotels, total] = await queryBuilder.getManyAndCount();
    const hydrated = await this.hydrateHotels(hotels.map((hotel) => hotel.id));

    return {
      items: this.toSummaries(hydrated),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findPublicDetails(hotelId: string): Promise<HotelDetailResponseDto> {
    const hotel = await this.hotelsRepository.findOne({
      where: { id: hotelId, isActive: true },
      relations: {
        images: true,
        amenityLinks: { amenity: true },
        rooms: {
          images: true,
          amenityLinks: { amenity: true },
        },
      },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const summary = this.toSummary(hotel);
    return {
      ...summary,
      description: hotel.description,
      addressLine: hotel.addressLine,
      locality: hotel.locality,
      postalCode: hotel.postalCode,
      latitude: hotel.latitude === null ? null : Number(hotel.latitude),
      longitude: hotel.longitude === null ? null : Number(hotel.longitude),
      checkInTime: hotel.checkInTime,
      checkOutTime: hotel.checkOutTime,
      policies: hotel.policies,
      images: hotelImages(hotel),
      rooms: (hotel.rooms ?? [])
        .filter((room) => room.isActive)
        .sort((left, right) => Number(left.basePrice) - Number(right.basePrice))
        .map((room) => toRoomSummary(room)),
    };
  }

  private validateSearch(query: SearchHotelsDto): void {
    const hasCheckIn = query.checkIn !== undefined;
    const hasCheckOut = query.checkOut !== undefined;
    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException(
        'checkIn and checkOut must be provided together.',
      );
    }
    if (query.checkIn && query.checkOut)
      assertValidStay(query.checkIn, query.checkOut);
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot exceed maxPrice.');
    }
  }

  private applySort(
    queryBuilder: ReturnType<Repository<Hotel>['createQueryBuilder']>,
    sortBy: HotelSortBy,
  ): void {
    const startingPrice = `(
      SELECT MIN(active_room.base_price)
      FROM hotel_rooms active_room
      WHERE active_room.hotel_id = hotel.id AND active_room.is_active = true
    )`;
    switch (sortBy) {
      case HotelSortBy.PRICE_ASC:
        queryBuilder.orderBy(startingPrice, 'ASC');
        break;
      case HotelSortBy.PRICE_DESC:
        queryBuilder.orderBy(startingPrice, 'DESC');
        break;
      case HotelSortBy.RATING:
        queryBuilder
          .orderBy('hotel.average_rating', 'DESC')
          .addOrderBy('hotel.review_count', 'DESC');
        break;
      case HotelSortBy.POPULARITY:
        queryBuilder
          .orderBy('hotel.review_count', 'DESC')
          .addOrderBy('hotel.average_rating', 'DESC');
        break;
      case HotelSortBy.RECOMMENDED:
      default:
        queryBuilder
          .orderBy('hotel.is_featured', 'DESC')
          .addOrderBy('hotel.average_rating', 'DESC')
          .addOrderBy('hotel.review_count', 'DESC');
        break;
    }
    queryBuilder.addOrderBy('hotel.id', 'ASC');
  }

  private hasActiveRoomClause(): string {
    return 'EXISTS (SELECT 1 FROM hotel_rooms active_room WHERE active_room.hotel_id = hotel.id AND active_room.is_active = true)';
  }

  private async hydrateHotels(ids: string[]): Promise<Hotel[]> {
    if (ids.length === 0) return [];
    const hotels = await this.hotelsRepository.find({
      where: { id: In(ids) },
      relations: {
        images: true,
        amenityLinks: { amenity: true },
        rooms: { images: true, amenityLinks: { amenity: true } },
      },
    });
    const byId = new Map(hotels.map((hotel) => [hotel.id, hotel]));
    return ids.flatMap((id) => {
      const hotel = byId.get(id);
      return hotel ? [hotel] : [];
    });
  }

  private toSummaries(hotels: Hotel[]): HotelSummaryResponseDto[] {
    return hotels.map((hotel) => this.toSummary(hotel));
  }

  private toSummary(hotel: Hotel): HotelSummaryResponseDto {
    const activeRooms = (hotel.rooms ?? []).filter((room) => room.isActive);
    const startingPrice = activeRooms.length
      ? Math.min(...activeRooms.map((room) => Number(room.basePrice)))
      : 0;
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
      startingPrice,
      currency: hotel.currency,
      primaryImage: primaryImageUrl(hotel),
      amenities: hotelAmenities(hotel),
    };
  }

  private async findDestinationPrimaryImage(
    city: string,
    state: string | null,
    country: string,
  ): Promise<string | null> {
    const image = await this.hotelImagesRepository
      .createQueryBuilder('image')
      .innerJoin('image.hotel', 'hotel')
      .where('hotel.is_active = true')
      .andWhere('hotel.city = :city', { city })
      .andWhere('hotel.state IS NOT DISTINCT FROM :state', { state })
      .andWhere('hotel.country = :country', { country })
      .orderBy('image.is_primary', 'DESC')
      .addOrderBy('image.sort_order', 'ASC')
      .addOrderBy('image.id', 'ASC')
      .getOne();
    return image?.imageUrl ?? null;
  }
}

function hotelImages(hotel: Hotel): HotelImageResponseDto[] {
  return (hotel.images ?? [])
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText,
      isPrimary: image.isPrimary,
      sortOrder: image.sortOrder,
    }));
}

function primaryImageUrl(hotel: Hotel): string | null {
  const images = hotelImages(hotel);
  return (
    images.find((image) => image.isPrimary)?.imageUrl ??
    images[0]?.imageUrl ??
    null
  );
}

function hotelAmenities(hotel: Hotel): HotelAmenityResponseDto[] {
  return (hotel.amenityLinks ?? [])
    .filter((link) => link.amenity?.isActive)
    .map((link) => ({
      id: link.amenity.id,
      name: link.amenity.name,
      icon: link.amenity.icon,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
