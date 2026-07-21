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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
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
import { CreateMenuCategoryDto } from './dto/create-menu-category.dto';
import { MenuCategoryResponseDto } from './dto/menu-category-response.dto';
import { ReorderMenuCategoriesDto } from './dto/reorder-menu-categories.dto';
import { UpdateMenuCategoryDto } from './dto/update-menu-category.dto';
import { MenuCategoriesService } from './menu-categories.service';

@ApiTags('Menu Categories')
@Controller()
export class MenuCategoriesController {
  constructor(
    private readonly menuCategoriesService: MenuCategoriesService,
    private readonly usersService: UsersService,
  ) {}

  @Get('restaurants/:restaurantId/categories')
  @ApiOperation({ summary: 'List public active categories for a restaurant' })
  @ApiOkResponse({ type: [MenuCategoryResponseDto] })
  @ApiNotFoundResponse({ description: 'Restaurant is missing or unavailable.' })
  async findPublicByRestaurantId(
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
  ): Promise<MenuCategoryResponseDto[]> {
    return this.menuCategoriesService.findPublicByRestaurantId(restaurantId);
  }

  @Get('menu-categories/:id')
  @ApiOperation({ summary: 'Get a public menu category by ID' })
  @ApiOkResponse({ type: MenuCategoryResponseDto })
  @ApiNotFoundResponse({
    description: 'Menu category is missing or unavailable.',
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<MenuCategoryResponseDto> {
    return this.menuCategoriesService.findOne(id);
  }

  @Post('menu-categories')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Create a menu category for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiCreatedResponse({ type: MenuCategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid menu category details.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiConflictResponse({ description: 'Category name already exists.' })
  async create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CreateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    return this.menuCategoriesService.create(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Patch('menu-categories/:id')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Update a menu category for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiOkResponse({ type: MenuCategoryResponseDto })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  @ApiNotFoundResponse({ description: 'Menu category not found.' })
  @ApiConflictResponse({ description: 'Category name already exists.' })
  async update(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ): Promise<MenuCategoryResponseDto> {
    return this.menuCategoriesService.update(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
      dto,
    );
  }

  @Delete('menu-categories/:id')
  @UseGuards(FirebaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a menu category' })
  @ApiBearerAuth('firebase-auth')
  @ApiNoContentResponse({ description: 'Menu category deactivated.' })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  async deactivate(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.menuCategoriesService.deactivate(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      id,
    );
  }

  @Patch('restaurants/:restaurantId/categories/reorder')
  @UseGuards(FirebaseAuthGuard)
  @ApiOperation({ summary: 'Reorder categories for an owned restaurant' })
  @ApiBearerAuth('firebase-auth')
  @ApiBody({ type: ReorderMenuCategoriesDto })
  @ApiOkResponse({ type: [MenuCategoryResponseDto] })
  @ApiBadRequestResponse({
    description: 'Every category must belong to the restaurant.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'Restaurant ownership is required.' })
  async reorder(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Body() dto: ReorderMenuCategoriesDto,
  ): Promise<MenuCategoryResponseDto[]> {
    return this.menuCategoriesService.reorder(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      dto.items,
    );
  }
}
