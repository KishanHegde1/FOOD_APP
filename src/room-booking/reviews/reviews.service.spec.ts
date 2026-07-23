/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { HotelBookingStatus } from '../common/enums/room-booking.enums';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { Hotel } from '../hotels/entities/hotel.entity';
import { User } from '../../users/entities/user.entity';
import { HotelReview } from './entities/hotel-review.entity';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111' } as User;
  const hotelId = '22222222-2222-4222-8222-222222222222';
  const bookingId = '33333333-3333-4333-8333-333333333333';

  function createService(eligibleBooking: HotelBooking | null) {
    const review = {
      id: 'review-id',
      bookingId,
      hotelId,
      userId: user.id,
      rating: 5,
      title: 'Excellent stay',
      comment: 'Very clean room.',
      isApproved: true,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    } as HotelReview;
    const reviewStatsQuery = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        averageRating: '5.0000000000000000',
        reviewCount: '1',
      }),
    };
    const reviewsRepository = {
      create: jest.fn().mockReturnValue(review),
      save: jest.fn().mockResolvedValue(review),
      createQueryBuilder: jest.fn().mockReturnValue(reviewStatsQuery),
    };
    const hotelsRepository = { update: jest.fn().mockResolvedValue(undefined) };
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: hotelId, isActive: true })
        .mockResolvedValueOnce(eligibleBooking),
      getRepository: jest.fn((target) => {
        if (target === HotelReview) return reviewsRepository;
        if (target === Hotel) return hotelsRepository;
        return undefined;
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    return {
      service: new ReviewsService(
        dataSource as never,
        reviewsRepository as never,
      ),
      reviewsRepository,
      hotelsRepository,
    };
  }

  it('requires a checked-out booking owned by the caller before creating a review', async () => {
    const { service } = createService(null);

    await expect(
      service.create(user, hotelId, {
        bookingId,
        rating: 5,
        title: 'Excellent stay',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates one eligible review and recalculates the hotel rating summary', async () => {
    const booking = {
      id: bookingId,
      userId: user.id,
      hotelId,
      bookingStatus: HotelBookingStatus.CHECKED_OUT,
    } as HotelBooking;
    const { service, hotelsRepository } = createService(booking);

    await expect(
      service.create(user, hotelId, {
        bookingId,
        rating: 5,
        title: 'Excellent stay',
        comment: 'Very clean room.',
      }),
    ).resolves.toMatchObject({ rating: 5, bookingId });
    expect(hotelsRepository.update).toHaveBeenCalledWith(hotelId, {
      averageRating: '5.00',
      reviewCount: 1,
    });
  });

  it('turns the unique booking-review constraint into a safe conflict', async () => {
    const booking = {
      id: bookingId,
      userId: user.id,
      hotelId,
      bookingStatus: HotelBookingStatus.CHECKED_OUT,
    } as HotelBooking;
    const { service, reviewsRepository } = createService(booking);
    reviewsRepository.save.mockRejectedValue({
      code: '23505',
      constraint: 'UQ_hotel_reviews_booking',
    });

    await expect(
      service.create(user, hotelId, { bookingId, rating: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
