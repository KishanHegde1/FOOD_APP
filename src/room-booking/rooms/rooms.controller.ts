import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { HotelRoomsQueryDto } from './dto/hotel-rooms-query.dto';
import {
  RoomDetailResponseDto,
  RoomSummaryResponseDto,
} from './dto/room-response.dto';
import { RoomsService } from './rooms.service';

@ApiTags('Room Booking - Rooms')
@Controller('room-booking')
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Get('hotels/:hotelId/rooms')
  @ApiOperation({
    summary: 'List active hotel rooms matching occupancy and dates',
  })
  @ApiOkResponse({ type: [RoomSummaryResponseDto] })
  @ApiBadRequestResponse({ description: 'Invalid stay dates or occupancy.' })
  @ApiNotFoundResponse({ description: 'Hotel not found.' })
  findForHotel(
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
    @Query() query: HotelRoomsQueryDto,
  ): Promise<RoomSummaryResponseDto[]> {
    return this.roomsService.findRoomsForHotel(hotelId, query);
  }

  @Get('rooms/:roomId')
  @ApiOperation({ summary: 'Get public room details and its hotel summary' })
  @ApiOkResponse({ type: RoomDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Room not found or inactive.' })
  findOne(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
  ): Promise<RoomDetailResponseDto> {
    return this.roomsService.findRoomDetails(roomId);
  }
}
