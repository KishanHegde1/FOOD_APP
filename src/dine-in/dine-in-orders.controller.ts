import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CreateDineInOrderDto } from './dto/create-dine-in-order.dto';
import {
  DineInOrderResponseDto,
  PaginatedDineInOrdersResponseDto,
} from './dto/dine-in-order-response.dto';
import { DineInSessionOrdersQueryDto } from './dto/dine-in-session-orders-query.dto';
import { DineInSessionOrderSummaryDto } from './dto/dine-in-session-order-summary.dto';
import { DineInOrdersService } from './dine-in-orders.service';

@ApiTags('Dine-In Orders')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('dine-in')
export class DineInOrdersController {
  constructor(
    private readonly ordersService: DineInOrdersService,
    private readonly usersService: UsersService,
  ) {}
  @Post('sessions/:sessionId/orders')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Place a dine-in order for an active session member',
  })
  @ApiCreatedResponse({ type: DineInOrderResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid order items.' })
  @ApiConflictResponse({
    description: 'SESSION_NOT_ACTIVE or FOOD_ITEM_UNAVAILABLE.',
  })
  @ApiForbiddenResponse({
    description: 'SESSION_ACCESS_DENIED or customer role required.',
  })
  @ApiNotFoundResponse({
    description: 'SESSION_NOT_FOUND or FOOD_ITEM_NOT_FOUND.',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many order submissions.' })
  async create(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CreateDineInOrderDto,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.create(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
      dto,
    );
  }
  @Get('sessions/:sessionId/orders')
  @ApiOkResponse({ type: PaginatedDineInOrdersResponseDto })
  @ApiOperation({
    summary: 'List all order rounds for a current or historical session member',
  })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: DineInSessionOrdersQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    return this.ordersService.listForSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
      query,
    );
  }
  @Get('sessions/:sessionId/active-orders')
  @ApiOkResponse({ type: [DineInOrderResponseDto] })
  @ApiOperation({ summary: 'List active order rounds for a dine-in session' })
  async listActive(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInOrderResponseDto[]> {
    return this.ordersService.listActiveForSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }
  @Get('sessions/:sessionId/order-summary')
  @ApiOkResponse({ type: DineInSessionOrderSummaryDto })
  @ApiOperation({
    summary: 'Get backend-calculated payable totals for a dine-in session',
  })
  async summary(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInSessionOrderSummaryDto> {
    return this.ordersService.getSessionSummary(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
    );
  }
  @Get('sessions/:sessionId/orders/:orderId')
  @ApiOkResponse({ type: DineInOrderResponseDto })
  @ApiOperation({ summary: 'Get one order round scoped to a dine-in session' })
  async getForSession(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.getForCustomerSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      sessionId,
      orderId,
    );
  }
  @Get('orders/:orderId')
  @ApiOkResponse({ type: DineInOrderResponseDto })
  @ApiOperation({
    summary: 'Get one dine-in order for an active session member',
  })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.getForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      orderId,
    );
  }
  @Post('orders/:orderId/cancel')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: DineInOrderResponseDto })
  @ApiOperation({ summary: 'Cancel a pending dine-in order' })
  @ApiConflictResponse({ description: 'ORDER_NOT_PENDING_APPROVAL.' })
  async cancel(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
  ): Promise<DineInOrderResponseDto> {
    return this.ordersService.cancel(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      orderId,
    );
  }
}
