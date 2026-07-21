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
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CreateFoodDto } from './dto/create-food.dto';
import { FoodQueryDto } from './dto/food-query.dto';
import { FoodResponseDto } from './dto/food-response.dto';
import { PaginatedFoodsResponseDto } from './dto/paginated-foods-response.dto';
import { RestaurantMenuResponseDto } from './dto/restaurant-menu-response.dto';
import { UpdateFoodAvailabilityDto } from './dto/update-food-availability.dto';
import { UpdateFoodDto } from './dto/update-food.dto';
import { FoodsService } from './foods.service';

@ApiTags('Foods', 'Restaurant Menu')
@Controller()
export class FoodsController {
  constructor(
    private readonly foodsService: FoodsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('restaurants/:restaurantId/menu')
  @ApiOperation({
    summary: 'Get an active restaurant menu grouped by active categories',
  })
  @ApiOkResponse({ type: RestaurantMenuResponseDto })
  @ApiNotFoundResponse({ description: 'Restaurant is missing or unavailable.' })
  async findRestaurantMenu(
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
  ): Promise<RestaurantMenuResponseDto> {
    return this.foodsService.findRestaurantMenu(restaurantId);
  }

  @Get('restaurants/:restaurantId/foods/manage')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'List all food items for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: PaginatedFoodsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query values.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  async findManagedFoods(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    return this.foodsService.findOwnedFoods(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      query,
    );
  }

  @Get('restaurants/:restaurantId/categories/:categoryId/foods')
  @ApiOperation({ summary: 'List public food items in a restaurant category' })
  @ApiOkResponse({ type: PaginatedFoodsResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid query values.' })
  @ApiNotFoundResponse({
    description: 'Restaurant or category is unavailable.',
  })
  async findFoodsByCategory(
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('categoryId', new ParseUUIDPipe()) categoryId: string,
    @Query() query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    return this.foodsService.findFoodsByCategory(
      restaurantId,
      categoryId,
      query,
    );
  }

  @Get('restaurants/:restaurantId/foods')
  @ApiOperation({ summary: 'List public food items for a restaurant' })
  @ApiOkResponse({ type: PaginatedFoodsResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid pagination or filter values.',
  })
  @ApiNotFoundResponse({ description: 'Restaurant is missing or unavailable.' })
  async findRestaurantFoods(
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: FoodQueryDto,
  ): Promise<PaginatedFoodsResponseDto> {
    return this.foodsService.findRestaurantFoods(restaurantId, query);
  }

  @Get('foods/:id')
  @ApiOperation({ summary: 'Get a public food item by ID' })
  @ApiOkResponse({ type: FoodResponseDto })
  @ApiNotFoundResponse({ description: 'Food item is missing or unavailable.' })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<FoodResponseDto> {
    return this.foodsService.findOnePublic(id);
  }

  @Post('foods')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Create a food item for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiCreatedResponse({ type: FoodResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid food, category, or price details.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiConflictResponse({
    description: 'An active food item with this name already exists.',
  })
  async create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CreateFoodDto,
  ): Promise<FoodResponseDto> {
    return this.foodsService.createForRestaurant(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Patch('foods/:id')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Update a food item for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: FoodResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid food, category, or price details.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiNotFoundResponse({ description: 'Food item not found.' })
  @ApiConflictResponse({
    description: 'An active food item with this name already exists.',
  })
  async update(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodDto,
  ): Promise<FoodResponseDto> {
    return this.foodsService.updateOwnedFood(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto,
    );
  }

  @Patch('foods/:id/availability')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Set temporary food availability' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: FoodResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid availability value.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiNotFoundResponse({ description: 'Food item not found.' })
  @ApiConflictResponse({
    description: 'Inactive food cannot be made available.',
  })
  async updateAvailability(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFoodAvailabilityDto,
  ): Promise<FoodResponseDto> {
    return this.foodsService.updateAvailability(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto,
    );
  }

  @Delete('foods/:id')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-deactivate a food item' })
  @ApiBearerAuth('firebase-auth')
  @ApiNoContentResponse({ description: 'Food item deactivated.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiNotFoundResponse({ description: 'Food item not found.' })
  async deactivate(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.foodsService.deactivateOwnedFood(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }
}
