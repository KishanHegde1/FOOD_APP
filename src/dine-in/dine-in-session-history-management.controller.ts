import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { PaginatedDineInOrdersResponseDto } from './dto/dine-in-order-response.dto';
import { DineInSessionOrdersQueryDto } from './dto/dine-in-session-orders-query.dto';
import { DineInSessionOrderSummaryDto } from './dto/dine-in-session-order-summary.dto';
import { DineInOrdersService } from './dine-in-orders.service';

@ApiTags('Dine-In Session Management')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/dine-in/sessions')
export class DineInSessionHistoryManagementController {
  constructor(
    private readonly ordersService: DineInOrdersService,
    private readonly usersService: UsersService,
  ) {}

  @Get(':sessionId/orders')
  @ApiOperation({
    summary: 'List all order rounds for a session in an owned restaurant',
  })
  @ApiOkResponse({ type: PaginatedDineInOrdersResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Query() query: DineInSessionOrdersQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    return this.ordersService.listForManagerSession(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      sessionId,
      query,
    );
  }

  @Get(':sessionId/order-summary')
  @ApiOperation({
    summary: 'Get backend-calculated session totals for an owned restaurant',
  })
  @ApiOkResponse({ type: DineInSessionOrderSummaryDto })
  async summary(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ): Promise<DineInSessionOrderSummaryDto> {
    return this.ordersService.getManagerSessionSummary(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      sessionId,
    );
  }
}
