import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { RoomAvailabilityResponseDto } from './dto/availability-response.dto';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from '../rooms/entities/hotel-room.entity';
import { RoomInventory } from '../rooms/entities/room-inventory.entity';
import {
  BookingPricingSnapshot,
  NightlyPriceSnapshot,
} from '../common/interfaces/room-booking.interfaces';
import { assertValidStay, stayDates } from '../common/utils/stay-dates.util';
import {
  numericToPaise,
  paiseToNumeric,
  taxFromPercentage,
} from '../common/utils/money.util';

export type LockedInventoryQuote = {
  rows: RoomInventory[];
  available: boolean;
  minimumAvailableRooms: number;
  pricing: BookingPricingSnapshot;
};

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(HotelRoom)
    private readonly roomsRepository: Repository<HotelRoom>,
    @InjectRepository(RoomInventory)
    private readonly inventoryRepository: Repository<RoomInventory>,
  ) {}

  async getRoomAvailability(
    roomId: string,
    dto: CheckAvailabilityDto,
  ): Promise<RoomAvailabilityResponseDto> {
    const stay = assertValidStay(dto.checkIn, dto.checkOut);
    const room = await this.roomsRepository.findOne({
      where: { id: roomId },
      relations: { hotel: true },
    });
    if (!room || !room.isActive || !room.hotel?.isActive) {
      throw new NotFoundException('Room not found.');
    }

    const rows = await this.inventoryRepository
      .createQueryBuilder('inventory')
      .where('inventory.room_id = :roomId', { roomId })
      .andWhere(
        'inventory.inventory_date >= :checkIn AND inventory.inventory_date < :checkOut',
        { checkIn: dto.checkIn, checkOut: dto.checkOut },
      )
      .orderBy('inventory.inventory_date', 'ASC')
      .getMany();
    const quote = this.quote(
      room,
      room.hotel,
      rows,
      stay.nights,
      dto.roomCount,
      stay.checkIn,
    );

    return {
      available: quote.available,
      requestedRoomCount: dto.roomCount,
      minimumAvailableRooms: quote.minimumAvailableRooms,
      numberOfNights: stay.nights,
      nightlyBreakdown: quote.pricing.nightlyBreakdown.map((night) => ({
        date: night.date,
        availableRooms: night.availableRooms ?? 0,
        pricePerRoom: Number(night.pricePerRoom),
        lineTotal: Number(night.lineTotal),
      })),
      subtotal: Number(quote.pricing.subtotal),
      estimatedTax: Number(quote.pricing.taxAmount),
      estimatedTotal: Number(quote.pricing.totalAmount),
      currency: room.currency,
    };
  }

  async lockAndQuote(
    manager: EntityManager,
    room: HotelRoom,
    hotel: Hotel,
    checkIn: string,
    checkOut: string,
    roomCount: number,
  ): Promise<LockedInventoryQuote> {
    const stay = assertValidStay(checkIn, checkOut);
    const rows = await this.lockInventoryRows(
      manager,
      room.id,
      checkIn,
      checkOut,
    );
    return this.quote(room, hotel, rows, stay.nights, roomCount, stay.checkIn);
  }

  async lockInventoryRows(
    manager: EntityManager,
    roomId: string,
    checkIn: string,
    checkOut: string,
  ): Promise<RoomInventory[]> {
    return manager
      .createQueryBuilder(RoomInventory, 'inventory')
      .setLock('pessimistic_write')
      .where('inventory.room_id = :roomId', { roomId })
      .andWhere(
        'inventory.inventory_date >= :checkIn AND inventory.inventory_date < :checkOut',
        { checkIn, checkOut },
      )
      .orderBy('inventory.inventory_date', 'ASC')
      .getMany();
  }

  ensureAvailable(quote: LockedInventoryQuote): void {
    if (!quote.available) {
      throw new ConflictException(
        'The requested number of rooms is not available for every selected night.',
      );
    }
  }

  private quote(
    room: HotelRoom,
    hotel: Hotel,
    rows: RoomInventory[],
    numberOfNights: number,
    roomCount: number,
    checkIn: Date,
  ): LockedInventoryQuote {
    const expectedDates = stayDates(checkIn, numberOfNights);
    const rowByDate = new Map(rows.map((row) => [row.inventoryDate, row]));
    const nightlyBreakdown: NightlyPriceSnapshot[] = [];
    let minimumAvailableRooms = Number.POSITIVE_INFINITY;
    let subtotalPaise = 0n;

    for (const date of expectedDates) {
      const inventory = rowByDate.get(date);
      const availableRooms = inventory
        ? inventory.totalInventory -
          inventory.reservedInventory -
          inventory.blockedInventory
        : 0;
      const pricePaise = numericToPaise(
        inventory?.priceOverride ?? room.basePrice,
      );
      const lineTotalPaise = pricePaise * BigInt(roomCount);

      minimumAvailableRooms = Math.min(minimumAvailableRooms, availableRooms);
      subtotalPaise += lineTotalPaise;
      nightlyBreakdown.push({
        date,
        pricePerRoom: paiseToNumeric(pricePaise),
        roomCount,
        lineTotal: paiseToNumeric(lineTotalPaise),
        availableRooms,
      });
    }

    const taxPercentage = room.taxPercentage ?? hotel.taxPercentage;
    const taxPaise = taxFromPercentage(subtotalPaise, taxPercentage);
    const totalPaise = subtotalPaise + taxPaise;
    const completeInventory = rows.length === expectedDates.length;
    const available = completeInventory && minimumAvailableRooms >= roomCount;

    return {
      rows,
      available,
      minimumAvailableRooms:
        minimumAvailableRooms === Number.POSITIVE_INFINITY
          ? 0
          : Math.max(0, minimumAvailableRooms),
      pricing: {
        nightlyBreakdown,
        subtotal: paiseToNumeric(subtotalPaise),
        taxAmount: paiseToNumeric(taxPaise),
        discountAmount: paiseToNumeric(0n),
        totalAmount: paiseToNumeric(totalPaise),
        taxPercentage: String(taxPercentage),
      },
    };
  }
}
