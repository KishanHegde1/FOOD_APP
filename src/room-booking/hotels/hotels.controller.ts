import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { SearchHotelsDto } from './dto/search-hotels.dto';
import {
  HotelDetailResponseDto,
  HotelSummaryResponseDto,
  PaginatedHotelsResponseDto,
  PopularDestinationResponseDto,
} from './dto/hotel-response.dto';
import { HotelsService } from './hotels.service';

@ApiTags('Room Booking - Hotels')
@Controller('room-booking')
export class HotelsController {
  constructor(private readonly hotelsService: HotelsService) {}

  @Get('hotels/featured')
  @ApiOperation({ summary: 'List active featured hotels' })
  @ApiOkResponse({ type: [HotelSummaryResponseDto] })
  findFeatured(): Promise<HotelSummaryResponseDto[]> {
    return this.hotelsService.findFeatured();
  }

  @Get('hotels/popular')
  @ApiOperation({
    summary:
      'List popular hotels by featured priority, bookings, rating, and reviews',
  })
  @ApiOkResponse({ type: [HotelSummaryResponseDto] })
  findPopular(): Promise<HotelSummaryResponseDto[]> {
    return this.hotelsService.findPopular();
  }

  @Get('destinations/popular')
  @ApiOperation({
    summary: 'List popular destinations with active hotel counts',
  })
  @ApiOkResponse({ type: [PopularDestinationResponseDto] })
  findPopularDestinations(): Promise<PopularDestinationResponseDto[]> {
    return this.hotelsService.findPopularDestinations();
  }

  @Get('hotels')
  @ApiOperation({ summary: 'Search active hotels and rooms' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'checkIn',
    required: false,
    type: String,
    example: '2026-08-01',
  })
  @ApiQuery({
    name: 'checkOut',
    required: false,
    type: String,
    example: '2026-08-04',
  })
  @ApiOkResponse({ type: PaginatedHotelsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid search filters or stay dates.',
  })
  search(@Query() query: SearchHotelsDto): Promise<PaginatedHotelsResponseDto> {
    return this.hotelsService.search(query);
  }

  @Get('hotels/:hotelId')
  @ApiOperation({
    summary: 'Get public hotel details and active room summaries',
  })
  @ApiOkResponse({ type: HotelDetailResponseDto })
  @ApiNotFoundResponse({ description: 'Hotel not found or inactive.' })
  findOne(
    @Param('hotelId', new ParseUUIDPipe()) hotelId: string,
  ): Promise<HotelDetailResponseDto> {
    return this.hotelsService.findPublicDetails(hotelId);
  }
}
