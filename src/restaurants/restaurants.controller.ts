import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CreateRestaurantDto } from './dto/create-restaurant.dto';
import { PaginatedRestaurantsResponseDto } from './dto/paginated-restaurants-response.dto';
import { RestaurantQueryDto } from './dto/restaurant-query.dto';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';
import { SetRestaurantOpenStatusDto } from './dto/set-restaurant-open-status.dto';
import { UpdateRestaurantDto } from './dto/update-restaurant.dto';
import { RestaurantsService } from './restaurants.service';

@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(
    private readonly restaurantsService: RestaurantsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List publicly available restaurants' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'city', required: false, type: String })
  @ApiQuery({ name: 'isPureVeg', required: false, type: Boolean })
  @ApiQuery({ name: 'isOpen', required: false, type: Boolean })
  @ApiQuery({
    name: 'openNow',
    required: false,
    type: Boolean,
    description: 'When true, excludes closed restaurants.',
  })
  @ApiQuery({ name: 'minimumRating', required: false, type: Number })
  @ApiQuery({ name: 'maximumDeliveryMinutes', required: false, type: Number })
  @ApiQuery({ name: 'maximumDeliveryFeePaise', required: false, type: Number })
  @ApiQuery({ name: 'latitude', required: false, type: Number })
  @ApiQuery({ name: 'longitude', required: false, type: Number })
  @ApiQuery({ name: 'radiusKm', required: false, type: Number })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: ['name', 'rating', 'deliveryTime', 'deliveryFee', 'createdAt'],
  })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiOkResponse({ type: PaginatedRestaurantsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter values.',
  })
  async findAll(
    @Query() query: RestaurantQueryDto,
  ): Promise<PaginatedRestaurantsResponseDto> {
    return this.restaurantsService.findAllPublic(query);
  }

  @Post()
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({
    summary: 'Create a pending restaurant for the authenticated owner',
  })
  @ApiBearerAuth('firebase-auth')
  @ApiCreatedResponse({ type: RestaurantResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid restaurant details.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only owners and admins can create restaurants.',
  })
  @ApiConflictResponse({
    description: 'Restaurant name or slug already exists.',
  })
  async create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CreateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.createForOwner(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Get('mine')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'List restaurants owned by the authenticated user' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: [RestaurantResponseDto] })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({
    description: 'Only owners and admins can view owned restaurants.',
  })
  async findMine(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
  ): Promise<RestaurantResponseDto[]> {
    return this.restaurantsService.findOwnedRestaurants(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a publicly available restaurant by ID' })
  @ApiOkResponse({ type: RestaurantResponseDto })
  @ApiNotFoundResponse({ description: 'Restaurant is missing or unavailable.' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.findOnePublic(id);
  }

  @Patch(':id')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Update an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: RestaurantResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiNotFoundResponse({ description: 'Restaurant not found.' })
  async update(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRestaurantDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.updateOwnedRestaurant(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto,
    );
  }

  @Patch(':id/open-status')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Set the open status of an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: RestaurantResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiConflictResponse({
    description: 'Inactive or suspended restaurants cannot open.',
  })
  async setOpenStatus(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetRestaurantOpenStatusDto,
  ): Promise<RestaurantResponseDto> {
    return this.restaurantsService.setOpenStatus(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto.isOpen,
    );
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiNoContentResponse({ description: 'Restaurant deactivated.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  async deactivate(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.restaurantsService.deactivateOwnedRestaurant(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }
}
