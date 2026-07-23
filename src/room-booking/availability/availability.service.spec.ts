import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from '../rooms/entities/hotel-room.entity';
import { RoomInventory } from '../rooms/entities/room-inventory.entity';
import { AvailabilityService } from './availability.service';

describe('AvailabilityService', () => {
  const room = (): HotelRoom =>
    ({
      id: '11111111-1111-4111-8111-111111111111',
      hotelId: '22222222-2222-4222-8222-222222222222',
      isActive: true,
      basePrice: '1000.00',
      taxPercentage: null,
      currency: 'INR',
      hotel: {
        id: '22222222-2222-4222-8222-222222222222',
        isActive: true,
        taxPercentage: '10.00',
      } as Hotel,
    }) as HotelRoom;

  const inventory = (
    inventoryDate: string,
    totalInventory: number,
    reservedInventory: number,
    blockedInventory = 0,
    priceOverride: string | null = null,
  ): RoomInventory =>
    ({
      inventoryDate,
      totalInventory,
      reservedInventory,
      blockedInventory,
      priceOverride,
    }) as RoomInventory;

  function serviceWith(rows: RoomInventory[], selectedRoom = room()) {
    const queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    const roomsRepository = {
      findOne: jest.fn().mockResolvedValue(selectedRoom),
    };
    const inventoryRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    return {
      service: new AvailabilityService(
        roomsRepository as never,
        inventoryRepository as never,
      ),
      roomsRepository,
      queryBuilder,
    };
  }

  it('uses every nightly row, price overrides, and decimal-safe tax pricing', async () => {
    const { service } = serviceWith([
      inventory('2030-08-01', 4, 1),
      inventory('2030-08-02', 2, 0, 0, '1200.00'),
    ]);

    await expect(
      service.getRoomAvailability(room().id, {
        checkIn: '2030-08-01',
        checkOut: '2030-08-03',
        roomCount: 2,
      }),
    ).resolves.toMatchObject({
      available: true,
      minimumAvailableRooms: 2,
      numberOfNights: 2,
      subtotal: 4400,
      estimatedTax: 440,
      estimatedTotal: 4840,
      nightlyBreakdown: [
        { date: '2030-08-01', pricePerRoom: 1000, lineTotal: 2000 },
        { date: '2030-08-02', pricePerRoom: 1200, lineTotal: 2400 },
      ],
    });
  });

  it('treats a missing inventory date as unavailable instead of unlimited', async () => {
    const { service } = serviceWith([inventory('2030-08-01', 10, 0)]);

    await expect(
      service.getRoomAvailability(room().id, {
        checkIn: '2030-08-01',
        checkOut: '2030-08-03',
        roomCount: 1,
      }),
    ).resolves.toMatchObject({
      available: false,
      minimumAvailableRooms: 0,
    });
  });

  it('rejects invalid check-out dates before querying inventory', async () => {
    const { service, roomsRepository } = serviceWith([]);

    await expect(
      service.getRoomAvailability(room().id, {
        checkIn: '2030-08-03',
        checkOut: '2030-08-01',
        roomCount: 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(roomsRepository.findOne).not.toHaveBeenCalled();
  });

  it('does not expose inactive rooms as available', async () => {
    const inactiveRoom = room();
    inactiveRoom.isActive = false;
    const { service } = serviceWith([], inactiveRoom);

    await expect(
      service.getRoomAvailability(inactiveRoom.id, {
        checkIn: '2030-08-01',
        checkOut: '2030-08-02',
        roomCount: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
