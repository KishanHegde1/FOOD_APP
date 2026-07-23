import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AvailabilityService } from '../availability/availability.service';
import { assertValidStay } from '../common/utils/stay-dates.util';
import { Hotel } from '../hotels/entities/hotel.entity';
import { HotelRoomsQueryDto } from './dto/hotel-rooms-query.dto';
import {
  RoomAmenityResponseDto,
  RoomDetailResponseDto,
  RoomImageResponseDto,
  RoomSummaryResponseDto,
} from './dto/room-response.dto';
import { HotelRoom } from './entities/hotel-room.entity';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Hotel)
    private readonly hotelsRepository: Repository<Hotel>,
    @InjectRepository(HotelRoom)
    private readonly roomsRepository: Repository<HotelRoom>,
    private readonly availabilityService: AvailabilityService,
  ) {}

  async findRoomsForHotel(
    hotelId: string,
    query: HotelRoomsQueryDto,
  ): Promise<RoomSummaryResponseDto[]> {
    const hasCheckIn = query.checkIn !== undefined;
    const hasCheckOut = query.checkOut !== undefined;
    if (hasCheckIn !== hasCheckOut) {
      throw new BadRequestException(
        'checkIn and checkOut must be provided together.',
      );
    }
    if (hasCheckIn && query.checkIn && query.checkOut) {
      assertValidStay(query.checkIn, query.checkOut);
    }

    const hotel = await this.hotelsRepository.findOne({
      where: { id: hotelId, isActive: true },
    });
    if (!hotel) throw new NotFoundException('Hotel not found.');

    const rooms = await this.roomsRepository.find({
      where: { hotelId, isActive: true },
      relations: {
        images: true,
        amenityLinks: { amenity: true },
      },
      order: { basePrice: 'ASC', id: 'ASC' },
    });
    const occupancyEligible = rooms.filter(
      (room) =>
        room.maxAdults >= query.adults && room.maxChildren >= query.children,
    );

    if (!hasCheckIn || !query.checkIn || !query.checkOut) {
      return occupancyEligible.map((room) => toRoomSummary(room));
    }

    const availability = await Promise.all(
      occupancyEligible.map(async (room) => ({
        room,
        result: await this.availabilityService.getRoomAvailability(room.id, {
          checkIn: query.checkIn!,
          checkOut: query.checkOut!,
          roomCount: query.rooms,
        }),
      })),
    );
    return availability
      .filter(({ result }) => result.available)
      .map(({ room }) => toRoomSummary(room));
  }

  async findRoomDetails(roomId: string): Promise<RoomDetailResponseDto> {
    const room = await this.roomsRepository.findOne({
      where: { id: roomId, isActive: true },
      relations: {
        hotel: true,
        images: true,
        amenityLinks: { amenity: true },
      },
    });
    if (!room || !room.hotel?.isActive) {
      throw new NotFoundException('Room not found.');
    }

    return {
      ...toRoomSummary(room),
      description: room.description,
      roomSizeSqft: room.roomSizeSqft,
      taxPercentage: Number(room.taxPercentage ?? room.hotel.taxPercentage),
      cancellationPolicy: room.cancellationPolicy,
      images: roomImages(room),
      hotel: {
        id: room.hotel.id,
        name: room.hotel.name,
        city: room.hotel.city,
        state: room.hotel.state,
        country: room.hotel.country,
        hotelType: room.hotel.hotelType,
        starRating: room.hotel.starRating,
        averageRating: Number(room.hotel.averageRating),
      },
    };
  }
}

export function toRoomSummary(room: HotelRoom): RoomSummaryResponseDto {
  const primaryImage = room.images
    ?.filter((image) => image.isPrimary)
    .sort((left, right) => left.sortOrder - right.sortOrder)[0];
  const fallbackImage = room.images
    ?.slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)[0];

  return {
    id: room.id,
    hotelId: room.hotelId,
    name: room.name,
    roomType: room.roomType,
    bedType: room.bedType,
    maxAdults: room.maxAdults,
    maxChildren: room.maxChildren,
    basePrice: Number(room.basePrice),
    currency: room.currency,
    primaryImage: primaryImage?.imageUrl ?? fallbackImage?.imageUrl ?? null,
    amenities: roomAmenities(room),
  };
}

function roomImages(room: HotelRoom): RoomImageResponseDto[] {
  return (room.images ?? [])
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((image) => ({
      id: image.id,
      imageUrl: image.imageUrl,
      altText: image.altText,
      isPrimary: image.isPrimary,
    }));
}

function roomAmenities(room: HotelRoom): RoomAmenityResponseDto[] {
  return (room.amenityLinks ?? [])
    .filter((link) => link.amenity?.isActive)
    .map((link) => ({
      id: link.amenity.id,
      name: link.amenity.name,
      icon: link.amenity.icon,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
