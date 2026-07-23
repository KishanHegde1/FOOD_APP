import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CheckAvailabilityDto } from './dto/check-availability.dto';
import { RoomAvailabilityResponseDto } from './dto/availability-response.dto';
import { AvailabilityService } from './availability.service';

@ApiTags('Room Booking - Availability')
@Controller('room-booking/rooms')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get(':roomId/availability')
  @ApiOperation({
    summary:
      'Quote room availability for check-in inclusive and check-out exclusive dates',
  })
  @ApiOkResponse({ type: RoomAvailabilityResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid check-in, check-out, or room count.',
  })
  @ApiNotFoundResponse({ description: 'Room not found or inactive.' })
  getAvailability(
    @Param('roomId', new ParseUUIDPipe()) roomId: string,
    @Query() query: CheckAvailabilityDto,
  ): Promise<RoomAvailabilityResponseDto> {
    return this.availabilityService.getRoomAvailability(roomId, query);
  }
}
