import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { RestaurantTableResponseDto } from './dto/restaurant-table-response.dto';
import {
  TableQrMetadataResponseDto,
  TableQrResponseDto,
} from './dto/table-qr-response.dto';
import { UpdateRestaurantTableDto } from './dto/update-restaurant-table.dto';
import { DineInService } from './dine-in.service';

@ApiTags('Dine-In Table Management')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/tables')
export class DineInManagementController {
  constructor(
    private readonly dineInService: DineInService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List tables for an owned restaurant' })
  @ApiOkResponse({ type: [RestaurantTableResponseDto] })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'Restaurant not found.' })
  async listTables(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
  ): Promise<RestaurantTableResponseDto[]> {
    return this.dineInService.listManagedTables(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
    );
  }

  @Post()
  @ApiOperation({
    summary: 'Create a restaurant table and issue its first QR token',
  })
  @ApiCreatedResponse({ type: TableQrResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid table number, display name, or capacity.',
  })
  @ApiConflictResponse({
    description: 'TABLE_NUMBER_ALREADY_EXISTS or RESTAURANT_INACTIVE.',
  })
  @ApiUnauthorizedResponse({
    description: 'Firebase authentication is required.',
  })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'Restaurant not found.' })
  async createTable(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Body() dto: CreateRestaurantTableDto,
  ): Promise<TableQrResponseDto> {
    return this.dineInService.createManagedTable(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      dto,
    );
  }

  @Patch(':tableId')
  @ApiOperation({
    summary: 'Update display, capacity, or active status of an owned table',
  })
  @ApiOkResponse({ type: RestaurantTableResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid table update.' })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  async updateTable(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
    @Body() dto: UpdateRestaurantTableDto,
  ): Promise<RestaurantTableResponseDto> {
    return this.dineInService.updateManagedTable(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      tableId,
      dto,
    );
  }

  @Post(':tableId/regenerate-qr')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Regenerate a table QR token and invalidate the previous token',
  })
  @ApiOkResponse({ type: TableQrResponseDto })
  @ApiConflictResponse({ description: 'RESTAURANT_INACTIVE.' })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  @ApiTooManyRequestsResponse({
    description: 'Too many QR regeneration requests.',
  })
  async regenerateQr(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
  ): Promise<TableQrResponseDto> {
    return this.dineInService.regenerateManagedTableQr(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      tableId,
    );
  }

  @Get(':tableId/qr')
  @ApiOperation({
    summary: 'Get non-secret QR metadata for an owned restaurant table',
  })
  @ApiOkResponse({ type: TableQrMetadataResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  @ApiNotFoundResponse({ description: 'TABLE_NOT_FOUND.' })
  async getQrMetadata(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('tableId', new ParseUUIDPipe()) tableId: string,
  ): Promise<TableQrMetadataResponseDto> {
    return this.dineInService.getManagedTableQrMetadata(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      tableId,
    );
  }
}
