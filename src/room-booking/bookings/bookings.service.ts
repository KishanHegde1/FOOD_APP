import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AvailabilityService } from '../availability/availability.service';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../common/enums/room-booking.enums';
import { CancellationPolicy } from '../common/interfaces/room-booking.interfaces';
import { numericToPaise, paiseToNumber } from '../common/utils/money.util';
import {
  assertValidStay,
  parseStayDate,
  startOfTodayUtc,
} from '../common/utils/stay-dates.util';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoom } from '../rooms/entities/hotel-room.entity';
import { RoomInventory } from '../rooms/entities/room-inventory.entity';
import { User } from '../../users/entities/user.entity';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { BookingQueryDto } from './dto/booking-query.dto';
import {
  HotelBookingResponseDto,
  PaginatedBookingsResponseDto,
} from './dto/booking-response.dto';
import { BookingGuest } from './entities/booking-guest.entity';
import { BookingStatusHistory } from './entities/booking-status-history.entity';
import { HotelBooking } from './entities/hotel-booking.entity';

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(HotelBooking)
    private readonly bookingsRepository: Repository<HotelBooking>,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async createBooking(
    user: User,
    dto: CreateBookingDto,
  ): Promise<HotelBookingResponseDto> {
    const stay = assertValidStay(dto.checkInDate, dto.checkOutDate);
    this.ensureGuestRequest(dto);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await this.dataSource.transaction((manager) =>
          this.createInTransaction(manager, user, dto, stay.nights),
        );
      } catch (error) {
        if (this.isBookingNumberCollision(error) && attempt < 3) continue;
        throw error;
      }
    }
    throw new ConflictException('Unable to generate a unique booking number.');
  }

  async findMyBookings(
    user: User,
    query: BookingQueryDto,
  ): Promise<PaginatedBookingsResponseDto> {
    const queryBuilder = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.hotel', 'hotel')
      .leftJoinAndSelect('booking.room', 'room')
      .where('booking.user_id = :userId', { userId: user.id });
    if (query.status) {
      queryBuilder.andWhere('booking.booking_status = :status', {
        status: query.status,
      });
    }

    const [items, total] = await queryBuilder
      .orderBy('booking.created_at', 'DESC')
      .addOrderBy('booking.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: items.map((booking) => this.toResponse(booking)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async findMyBooking(
    user: User,
    bookingId: string,
  ): Promise<HotelBookingResponseDto> {
    const booking = await this.bookingsRepository.findOne({
      where: { id: bookingId, userId: user.id },
      relations: { hotel: true, room: true, guests: true },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return this.toResponse(booking);
  }

  async cancelBooking(
    user: User,
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<HotelBookingResponseDto> {
    return this.dataSource.transaction((manager) =>
      this.cancelInTransaction(manager, user, bookingId, dto),
    );
  }

  private async createInTransaction(
    manager: EntityManager,
    user: User,
    dto: CreateBookingDto,
    numberOfNights: number,
  ): Promise<HotelBookingResponseDto> {
    const hotel = await manager.findOne(Hotel, {
      where: { id: dto.hotelId, isActive: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const room = await manager.findOne(HotelRoom, {
      where: { id: dto.roomId, hotelId: hotel.id, isActive: true },
    });
    if (!room) throw new NotFoundException('Room not found.');
    this.ensureOccupancy(room, dto);

    const quote = await this.availabilityService.lockAndQuote(
      manager,
      room,
      hotel,
      dto.checkInDate,
      dto.checkOutDate,
      dto.roomCount,
    );
    this.availabilityService.ensureAvailable(quote);

    const booking = manager.getRepository(HotelBooking).create({
      bookingNumber: this.newBookingNumber(),
      userId: user.id,
      hotelId: hotel.id,
      roomId: room.id,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      numberOfNights,
      roomCount: dto.roomCount,
      adultCount: dto.adultCount,
      childCount: dto.childCount,
      contactName: dto.contactName.trim(),
      contactPhone: dto.contactPhone.trim(),
      contactEmail: dto.contactEmail?.trim().toLowerCase() || null,
      specialRequests: dto.specialRequests?.trim() || null,
      paymentMethod: HotelPaymentMethod.PAY_AT_HOTEL,
      paymentStatus: HotelPaymentStatus.PAY_AT_HOTEL,
      bookingStatus: HotelBookingStatus.CONFIRMED,
      currency: room.currency,
      nightlyPriceBreakdown: quote.pricing.nightlyBreakdown,
      subtotal: quote.pricing.subtotal,
      taxAmount: quote.pricing.taxAmount,
      discountAmount: quote.pricing.discountAmount,
      totalAmount: quote.pricing.totalAmount,
      cancellationReason: null,
      confirmedAt: new Date(),
      cancelledAt: null,
      checkedInAt: null,
      checkedOutAt: null,
    });
    const savedBooking = await manager
      .getRepository(HotelBooking)
      .save(booking);

    const selectedPrimaryIndex = dto.guests.findIndex(
      (guest) => guest.isPrimaryGuest === true,
    );
    const guests = dto.guests.map((guest, index) =>
      manager.getRepository(BookingGuest).create({
        bookingId: savedBooking.id,
        fullName: guest.fullName.trim(),
        age: guest.age ?? null,
        isPrimaryGuest:
          selectedPrimaryIndex >= 0
            ? index === selectedPrimaryIndex
            : index === 0,
      }),
    );
    const savedGuests = await manager.getRepository(BookingGuest).save(guests);

    for (const inventory of quote.rows) {
      inventory.reservedInventory += dto.roomCount;
    }
    await manager.getRepository(RoomInventory).save(quote.rows);

    await manager.getRepository(BookingStatusHistory).save(
      manager.getRepository(BookingStatusHistory).create({
        bookingId: savedBooking.id,
        status: HotelBookingStatus.CONFIRMED,
        changedByUserId: user.id,
        reason: 'PAY_AT_HOTEL_CONFIRMED',
      }),
    );

    savedBooking.hotel = hotel;
    savedBooking.room = room;
    savedBooking.guests = savedGuests;
    return this.toResponse(savedBooking);
  }

  private async cancelInTransaction(
    manager: EntityManager,
    user: User,
    bookingId: string,
    dto: CancelBookingDto,
  ): Promise<HotelBookingResponseDto> {
    const booking = await manager
      .getRepository(HotelBooking)
      .createQueryBuilder('booking')
      .setLock('pessimistic_write')
      .where('booking.id = :bookingId', { bookingId })
      .getOne();
    if (!booking) throw new NotFoundException('Booking not found.');
    if (booking.userId !== user.id) {
      throw new ForbiddenException("You cannot cancel another user's booking.");
    }
    if (
      booking.bookingStatus !== HotelBookingStatus.CONFIRMED &&
      booking.bookingStatus !== HotelBookingStatus.PENDING
    ) {
      throw new ConflictException('This booking cannot be cancelled.');
    }

    const checkIn = parseStayDate(booking.checkInDate, 'checkInDate');
    if (checkIn <= startOfTodayUtc()) {
      throw new ConflictException(
        'Bookings cannot be cancelled on or after check-in date.',
      );
    }

    const room = await manager.findOne(HotelRoom, {
      where: { id: booking.roomId },
    });
    if (!room)
      throw new ConflictException(
        'The booked room is no longer available for cancellation.',
      );
    this.ensureCancellationAllowed(room.cancellationPolicy, checkIn);

    const inventoryRows = await this.availabilityService.lockInventoryRows(
      manager,
      booking.roomId,
      booking.checkInDate,
      booking.checkOutDate,
    );
    if (inventoryRows.length !== booking.numberOfNights) {
      throw new ConflictException(
        'Booking inventory is incomplete and cannot be cancelled safely.',
      );
    }
    for (const inventory of inventoryRows) {
      if (inventory.reservedInventory < booking.roomCount) {
        throw new ConflictException(
          'Booking inventory cannot be restored safely.',
        );
      }
      inventory.reservedInventory -= booking.roomCount;
    }
    await manager.getRepository(RoomInventory).save(inventoryRows);

    booking.bookingStatus = HotelBookingStatus.CANCELLED;
    booking.cancellationReason = dto.reason?.trim() || null;
    booking.cancelledAt = new Date();
    const savedBooking = await manager
      .getRepository(HotelBooking)
      .save(booking);
    await manager.getRepository(BookingStatusHistory).save(
      manager.getRepository(BookingStatusHistory).create({
        bookingId: savedBooking.id,
        status: HotelBookingStatus.CANCELLED,
        changedByUserId: user.id,
        reason: savedBooking.cancellationReason,
      }),
    );

    savedBooking.room = room;
    const hotel = await manager.findOneBy(Hotel, {
      id: savedBooking.hotelId,
    });
    if (!hotel) {
      throw new ConflictException('The booked hotel is no longer available.');
    }
    savedBooking.hotel = hotel;
    savedBooking.guests = await manager.getRepository(BookingGuest).find({
      where: { bookingId: savedBooking.id },
      order: { createdAt: 'ASC' },
    });
    return this.toResponse(savedBooking);
  }

  private ensureGuestRequest(dto: CreateBookingDto): void {
    const primaryGuestCount = dto.guests.filter(
      (guest) => guest.isPrimaryGuest === true,
    ).length;
    if (primaryGuestCount > 1) {
      throw new BadRequestException('Only one primary guest can be selected.');
    }
  }

  private ensureOccupancy(room: HotelRoom, dto: CreateBookingDto): void {
    if (dto.adultCount > room.maxAdults * dto.roomCount) {
      throw new ConflictException(
        'The selected room count cannot accommodate the requested adults.',
      );
    }
    if (dto.childCount > room.maxChildren * dto.roomCount) {
      throw new ConflictException(
        'The selected room count cannot accommodate the requested children.',
      );
    }
  }

  private ensureCancellationAllowed(
    policy: CancellationPolicy,
    checkIn: Date,
  ): void {
    if (policy?.refundable === false) {
      throw new ConflictException(
        'This room is not eligible for cancellation.',
      );
    }
    const freeCancellationHours = policy?.freeCancellationHours;
    if (
      typeof freeCancellationHours === 'number' &&
      Number.isFinite(freeCancellationHours) &&
      freeCancellationHours > 0
    ) {
      const deadline = new Date(
        checkIn.getTime() - freeCancellationHours * 60 * 60 * 1000,
      );
      if (new Date() >= deadline) {
        throw new ConflictException(
          'The free-cancellation deadline has passed.',
        );
      }
    }
  }

  private newBookingNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = randomBytes(3).toString('hex').toUpperCase();
    return `HB-${date}-${random}`;
  }

  private isBookingNumberCollision(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505' &&
      'constraint' in error &&
      error.constraint === 'UQ_hotel_bookings_number'
    );
  }

  private toResponse(booking: HotelBooking): HotelBookingResponseDto {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.bookingStatus,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfNights: booking.numberOfNights,
      roomCount: booking.roomCount,
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      subtotal: paiseToNumber(numericToPaise(booking.subtotal)),
      taxAmount: paiseToNumber(numericToPaise(booking.taxAmount)),
      discountAmount: paiseToNumber(numericToPaise(booking.discountAmount)),
      totalAmount: paiseToNumber(numericToPaise(booking.totalAmount)),
      currency: booking.currency,
      nightlyBreakdown: booking.nightlyPriceBreakdown.map((night) => ({
        date: night.date,
        roomCount: night.roomCount,
        pricePerRoom: Number(night.pricePerRoom),
        lineTotal: Number(night.lineTotal),
      })),
      hotel: booking.hotel
        ? {
            id: booking.hotel.id,
            name: booking.hotel.name,
            city: booking.hotel.city,
            state: booking.hotel.state,
            country: booking.hotel.country,
          }
        : { id: booking.hotelId },
      room: booking.room
        ? {
            id: booking.room.id,
            name: booking.room.name,
            roomType: booking.room.roomType,
            bedType: booking.room.bedType,
          }
        : { id: booking.roomId },
      guests: (booking.guests ?? []).map((guest) => ({
        id: guest.id,
        fullName: guest.fullName,
        age: guest.age,
        isPrimaryGuest: guest.isPrimaryGuest,
      })),
      cancellationReason: booking.cancellationReason,
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }
}
