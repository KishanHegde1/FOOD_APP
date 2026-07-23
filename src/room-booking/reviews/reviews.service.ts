import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { HotelBookingStatus } from '../common/enums/room-booking.enums';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { CreateReviewDto } from './dto/create-review.dto';
import {
  HotelReviewResponseDto,
  PaginatedHotelReviewsResponseDto,
} from './dto/review-response.dto';
import { ReviewQueryDto } from './dto/review-query.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { HotelReview } from './entities/hotel-review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(HotelReview)
    private readonly reviewsRepository: Repository<HotelReview>,
  ) {}

  async findPublic(
    hotelId: string,
    query: ReviewQueryDto,
  ): Promise<PaginatedHotelReviewsResponseDto> {
    const [items, total] = await this.reviewsRepository.findAndCount({
      where: { hotelId, isApproved: true },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: items.map((review) => this.toResponse(review)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async create(
    user: User,
    hotelId: string,
    dto: CreateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    try {
      return await this.dataSource.transaction((manager) =>
        this.createInTransaction(manager, user, hotelId, dto),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('This booking already has a review.');
      }
      throw error;
    }
  }

  async update(
    user: User,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    if (
      dto.rating === undefined &&
      dto.title === undefined &&
      dto.comment === undefined
    ) {
      throw new BadRequestException(
        'At least one review field must be provided.',
      );
    }
    return this.dataSource.transaction((manager) =>
      this.updateInTransaction(manager, user, reviewId, dto),
    );
  }

  async remove(user: User, reviewId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const review = await this.lockReview(manager, reviewId);
      if (!review) throw new NotFoundException('Review not found.');
      if (review.userId !== user.id) {
        throw new ForbiddenException(
          "You cannot delete another user's review.",
        );
      }
      await manager.getRepository(HotelReview).remove(review);
      await this.recalculateHotelRating(manager, review.hotelId);
    });
  }

  private async createInTransaction(
    manager: EntityManager,
    user: User,
    hotelId: string,
    dto: CreateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    const hotel = await manager.findOne(Hotel, {
      where: { id: hotelId, isActive: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const booking = await manager.findOne(HotelBooking, {
      where: {
        id: dto.bookingId,
        userId: user.id,
        hotelId,
        bookingStatus: HotelBookingStatus.CHECKED_OUT,
      },
    });
    if (!booking) {
      throw new ForbiddenException(
        'A checked-out booking at this hotel is required to add a review.',
      );
    }

    const review = await manager.getRepository(HotelReview).save(
      manager.getRepository(HotelReview).create({
        hotelId,
        bookingId: booking.id,
        userId: user.id,
        rating: dto.rating,
        title: dto.title?.trim() || null,
        comment: dto.comment?.trim() || null,
        isApproved: true,
      }),
    );
    await this.recalculateHotelRating(manager, hotelId);
    return this.toResponse(review);
  }

  private async updateInTransaction(
    manager: EntityManager,
    user: User,
    reviewId: string,
    dto: UpdateReviewDto,
  ): Promise<HotelReviewResponseDto> {
    const review = await this.lockReview(manager, reviewId);
    if (!review) throw new NotFoundException('Review not found.');
    if (review.userId !== user.id) {
      throw new ForbiddenException("You cannot edit another user's review.");
    }

    if (dto.rating !== undefined) review.rating = dto.rating;
    if (dto.title !== undefined) review.title = dto.title.trim() || null;
    if (dto.comment !== undefined) review.comment = dto.comment.trim() || null;
    const saved = await manager.getRepository(HotelReview).save(review);
    await this.recalculateHotelRating(manager, saved.hotelId);
    return this.toResponse(saved);
  }

  private async lockReview(
    manager: EntityManager,
    reviewId: string,
  ): Promise<HotelReview | null> {
    return manager
      .getRepository(HotelReview)
      .createQueryBuilder('review')
      .setLock('pessimistic_write')
      .where('review.id = :reviewId', { reviewId })
      .getOne();
  }

  private async recalculateHotelRating(
    manager: EntityManager,
    hotelId: string,
  ): Promise<void> {
    const stats = await manager
      .getRepository(HotelReview)
      .createQueryBuilder('review')
      .select('COALESCE(AVG(review.rating), 0)', 'averageRating')
      .addSelect('COUNT(review.id)', 'reviewCount')
      .where('review.hotel_id = :hotelId', { hotelId })
      .andWhere('review.is_approved = true')
      .getRawOne<{ averageRating: string; reviewCount: string }>();

    await manager.getRepository(Hotel).update(hotelId, {
      averageRating: Number(stats?.averageRating ?? 0).toFixed(2),
      reviewCount: Number(stats?.reviewCount ?? 0),
    });
  }

  private toResponse(review: HotelReview): HotelReviewResponseDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      title: review.title,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
      updatedAt: review.updatedAt.toISOString(),
    };
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
