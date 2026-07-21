import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FoodSearchQueryDto } from './dto/food-search-query.dto';
import { HomeQueryDto } from './dto/home-query.dto';
import { HomeResponseDto } from './dto/home-response.dto';
import { RestaurantSearchQueryDto } from './dto/restaurant-search-query.dto';
import {
  PaginatedFoodSearchResponseDto,
  PaginatedRestaurantSearchResponseDto,
  SearchResponseDto,
} from './dto/search-response.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchSuggestionsQueryDto } from './dto/search-suggestions-query.dto';
import { SearchSuggestionsResponseDto } from './dto/search-suggestions-response.dto';
import { DiscoveryService } from './discovery.service';

@ApiTags('Home', 'Discovery', 'Search')
@Controller()
export class DiscoveryController {
  constructor(private readonly discoveryService: DiscoveryService) {}

  @Get('home')
  @ApiOperation({
    summary:
      'Get deterministic popular and recommended restaurant and food discovery sections',
  })
  @ApiOkResponse({ type: HomeResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid filter or location parameters.',
  })
  @ApiInternalServerErrorResponse({
    description: 'Discovery data could not be loaded.',
  })
  async getHome(@Query() query: HomeQueryDto): Promise<HomeResponseDto> {
    return this.discoveryService.getHome(query);
  }

  @Get('search/restaurants')
  @ApiOperation({
    summary: 'Search public restaurants with filters and pagination',
  })
  @ApiOkResponse({ type: PaginatedRestaurantSearchResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid search, sort, or location parameters.',
  })
  async searchRestaurants(
    @Query() query: RestaurantSearchQueryDto,
  ): Promise<PaginatedRestaurantSearchResponseDto> {
    return this.discoveryService.searchRestaurants(query);
  }

  @Get('search/foods')
  @ApiOperation({
    summary: 'Search public available food items with pagination',
  })
  @ApiOkResponse({ type: PaginatedFoodSearchResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid search, price, or filter parameters.',
  })
  async searchFoods(
    @Query() query: FoodSearchQueryDto,
  ): Promise<PaginatedFoodSearchResponseDto> {
    return this.discoveryService.searchFoods(query);
  }

  @Get('search/suggestions')
  @ApiOperation({
    summary: 'Return public restaurant and food type-ahead suggestions',
  })
  @ApiOkResponse({ type: SearchSuggestionsResponseDto })
  @ApiBadRequestResponse({
    description: 'Search suggestions require at least 2 characters.',
  })
  async getSuggestions(
    @Query() query: SearchSuggestionsQueryDto,
  ): Promise<SearchSuggestionsResponseDto> {
    return this.discoveryService.getSuggestions(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search public restaurant and food sections together',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  @ApiBadRequestResponse({
    description: 'Search requires at least 2 characters and valid filters.',
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    return this.discoveryService.search(query);
  }
}
