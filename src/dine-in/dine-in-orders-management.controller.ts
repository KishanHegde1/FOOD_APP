import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import {
  DineInOrderResponseDto,
  PaginatedDineInOrdersResponseDto,
} from './dto/dine-in-order-response.dto';
import { ManagerDineInOrderListQueryDto } from './dto/manager-dine-in-order-list-query.dto';
import { RejectDineInOrderDto } from './dto/reject-dine-in-order.dto';
import { DineInOrdersService } from './dine-in-orders.service';

@ApiTags('Dine-In Order Management')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/dine-in/orders')
export class DineInOrdersManagementController {
  constructor(
    private readonly ordersService: DineInOrdersService,
    private readonly usersService: UsersService,
  ) {}
  @Get()
  @ApiOperation({
    summary: 'List paginated dine-in orders for an owned restaurant',
  })
  @ApiOkResponse({ type: PaginatedDineInOrdersResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: ManagerDineInOrderListQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    return this.ordersService.listForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      query,
    );
  }
  @Get(':orderId')
  @ApiOperation({ summary: 'Get an owned restaurant dine-in order' })
  @ApiOkResponse({ type: DineInOrderResponseDto })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.getForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      orderId,
    );
  }
  @Post(':orderId/approve')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Approve a pending dine-in order and create its kitchen ticket',
  })
  @ApiOkResponse({ type: DineInOrderResponseDto })
  @ApiConflictResponse({ description: 'ORDER_NOT_PENDING_APPROVAL.' })
  @ApiTooManyRequestsResponse({ description: 'Too many approval requests.' })
  async approve(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.approve(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      orderId,
    );
  }
  @Post(':orderId/reject')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Reject a pending dine-in order' })
  @ApiOkResponse({ type: DineInOrderResponseDto })
  @ApiConflictResponse({ description: 'ORDER_NOT_PENDING_APPROVAL.' })
  @ApiTooManyRequestsResponse({ description: 'Too many rejection requests.' })
  async reject(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Body() dto: RejectDineInOrderDto,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.reject(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      orderId,
      dto,
    );
  }
}
