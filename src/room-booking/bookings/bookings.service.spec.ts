/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../common/enums/room-booking.enums';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from '../rooms/entities/hotel-room.entity';
import { RoomInventory } from '../rooms/entities/room-inventory.entity';
import { User } from '../../users/entities/user.entity';
import { AvailabilityService } from '../availability/availability.service';
import { BookingGuest } from './entities/booking-guest.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { HotelBooking } from './entities/hotel-booking.entity';
import { BookingsService } from './bookings.service';

describe('BookingsService', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111' } as User;
  const hotel = {
    id: '22222222-2222-4222-8222-222222222222',
    isActive: true,
    taxPercentage: '10.00',
    name: 'Test Hotel',
    city: 'Goa',
    state: null,
    country: 'India',
    images: [
      {
        imageUrl: 'https://cdn.example.test/hotels/test-hotel.webp',
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  } as Hotel;
  const room = {
    id: '33333333-3333-4333-8333-333333333333',
    hotelId: hotel.id,
    isActive: true,
    name: 'Deluxe Room',
    roomType: 'DELUXE',
    bedType: 'QUEEN',
    maxAdults: 2,
    maxChildren: 1,
    basePrice: '1000.00',
    taxPercentage: null,
    currency: 'INR',
    cancellationPolicy: { refundable: true, freeCancellationHours: 24 },
    images: [
      {
        imageUrl: 'https://cdn.example.test/rooms/deluxe.webp',
        isPrimary: true,
        sortOrder: 0,
      },
    ],
  } as HotelRoom;

  const bookingDto = () => ({
    hotelId: hotel.id,
    roomId: room.id,
    checkInDate: '2030-08-05',
    checkOutDate: '2030-08-07',
    roomCount: 1,
    adultCount: 2,
    childCount: 0,
    contactName: 'Asha Sharma',
    contactPhone: '+918888888888',
    contactEmail: 'asha@example.com',
    paymentMethod: HotelPaymentMethod.PAY_AT_HOTEL,
    guests: [{ fullName: 'Asha Sharma', isPrimaryGuest: true }],
  });

  function createService() {
    const inventoryRows = [
      {
        id: 'inv-1',
        roomId: room.id,
        inventoryDate: '2030-08-05',
        totalInventory: 2,
        reservedInventory: 0,
        blockedInventory: 0,
        priceOverride: null,
      },
      {
        id: 'inv-2',
        roomId: room.id,
        inventoryDate: '2030-08-06',
        totalInventory: 2,
        reservedInventory: 0,
        blockedInventory: 0,
        priceOverride: null,
      },
    ] as RoomInventory[];
    const bookingRepository = {
      create: jest.fn((value) => ({
        ...value,
        id: 'booking-id',
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
        updatedAt: new Date('2030-01-01T00:00:00.000Z'),
      })),
      save: jest.fn(async (value) => value),
      createQueryBuilder: jest.fn(),
    };
    const guestsRepository = {
      create: jest.fn((value) => ({ ...value, id: 'guest-id' })),
      save: jest.fn(async (value) => value),
      find: jest.fn().mockResolvedValue([]),
    };
    const inventoryRepository = { save: jest.fn(async (value) => value) };
    const historyRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const repositories = new Map([
      [HotelBooking, bookingRepository],
      [BookingGuest, guestsRepository],
      [RoomInventory, inventoryRepository],
      [BookingStatusHistory, historyRepository],
    ]);
    const manager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(hotel)
        .mockResolvedValueOnce(room),
      findOneBy: jest.fn().mockResolvedValue(hotel),
      getRepository: jest.fn((target) => repositories.get(target)),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const availabilityService = {
      lockAndQuote: jest.fn().mockResolvedValue({
        rows: inventoryRows,
        available: true,
        minimumAvailableRooms: 2,
        pricing: {
          nightlyBreakdown: [
            {
              date: '2030-08-05',
              pricePerRoom: '1000.00',
              roomCount: 1,
              lineTotal: '1000.00',
            },
            {
              date: '2030-08-06',
              pricePerRoom: '1000.00',
              roomCount: 1,
              lineTotal: '1000.00',
            },
          ],
          subtotal: '2000.00',
          taxAmount: '200.00',
          discountAmount: '0.00',
          totalAmount: '2200.00',
          taxPercentage: '10.00',
        },
      }),
      ensureAvailable: jest.fn(),
      lockInventoryRows: jest.fn().mockResolvedValue(inventoryRows),
    } as unknown as AvailabilityService;
    const service = new BookingsService(
      dataSource as never,
      bookingRepository as never,
      availabilityService,
    );
    return {
      service,
      dataSource,
      manager,
      bookingRepository,
      guestsRepository,
      inventoryRepository,
      historyRepository,
      availabilityService,
      inventoryRows,
    };
  }

  it('creates an atomically confirmed Pay at Hotel booking and reserves every night', async () => {
    const {
      service,
      inventoryRows,
      inventoryRepository,
      historyRepository,
      availabilityService,
    } = createService();

    const result = await service.createBooking(user, bookingDto());

    expect(result.bookingNumber).toMatch(/^HB-\d{8}-[A-Z0-9]{6}$/);
    expect(result.bookingStatus).toBe(HotelBookingStatus.CONFIRMED);
    expect(result.paymentMethod).toBe(HotelPaymentMethod.PAY_AT_HOTEL);
    expect(result.paymentStatus).toBe(HotelPaymentStatus.PAY_AT_HOTEL);
    expect(result.totalAmount).toBe(2200);
    expect(result.hotel.primaryImage).toBe(
      'https://cdn.example.test/hotels/test-hotel.webp',
    );
    expect(result.room.primaryImage).toBe(
      'https://cdn.example.test/rooms/deluxe.webp',
    );
    expect(availabilityService.ensureAvailable).toHaveBeenCalled();
    expect(inventoryRows.map((row) => row.reservedInventory)).toEqual([1, 1]);
    expect(inventoryRepository.save).toHaveBeenCalledWith(inventoryRows);
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: HotelBookingStatus.CONFIRMED }),
    );
  });

  it('rejects room occupancy before any inventory lock is requested', async () => {
    const { service, availabilityService } = createService();
    const dto = bookingDto();
    dto.adultCount = 3;

    await expect(service.createBooking(user, dto)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(availabilityService.lockAndQuote).not.toHaveBeenCalled();
  });

  it('restores reserved inventory when an owned confirmed booking is cancelled', async () => {
    const {
      service,
      manager,
      inventoryRows,
      inventoryRepository,
      historyRepository,
      bookingRepository,
      guestsRepository,
    } = createService();
    const booking = {
      id: 'booking-id',
      bookingNumber: 'HB-20300801-ABC123',
      userId: user.id,
      hotelId: hotel.id,
      roomId: room.id,
      checkInDate: '2030-08-05',
      checkOutDate: '2030-08-07',
      numberOfNights: 2,
      roomCount: 1,
      adultCount: 2,
      childCount: 0,
      paymentMethod: HotelPaymentMethod.PAY_AT_HOTEL,
      paymentStatus: HotelPaymentStatus.PAY_AT_HOTEL,
      bookingStatus: HotelBookingStatus.CONFIRMED,
      currency: 'INR',
      nightlyPriceBreakdown: [],
      subtotal: '2000.00',
      taxAmount: '200.00',
      discountAmount: '0.00',
      totalAmount: '2200.00',
      cancellationReason: null,
      confirmedAt: new Date('2030-01-01T00:00:00.000Z'),
      cancelledAt: null,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    } as HotelBooking;
    bookingRepository.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(booking),
    });
    bookingRepository.save.mockImplementation(async (value) => value);
    guestsRepository.find.mockResolvedValue([]);
    manager.findOne.mockResolvedValue(room);
    inventoryRows.forEach((row) => {
      row.reservedInventory = 1;
    });

    const result = await service.cancelBooking(user, booking.id, {
      reason: 'Travel plan changed',
    });

    expect(result.bookingStatus).toBe(HotelBookingStatus.CANCELLED);
    expect(inventoryRows.map((row) => row.reservedInventory)).toEqual([0, 0]);
    expect(inventoryRepository.save).toHaveBeenCalledWith(inventoryRows);
    expect(historyRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: HotelBookingStatus.CANCELLED }),
    );
  });

  it('rejects cancellation attempts for another user before changing inventory', async () => {
    const { service, bookingRepository, inventoryRepository } = createService();
    bookingRepository.createQueryBuilder.mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'booking-id',
        userId: '44444444-4444-4444-8444-444444444444',
      }),
    });

    await expect(
      service.cancelBooking(user, 'booking-id', { reason: 'No access' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(inventoryRepository.save).not.toHaveBeenCalled();
  });
});
