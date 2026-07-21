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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { DineInPaymentListQueryDto } from './dto/dine-in-payment-list-query.dto';
import {
  DineInPaymentResponseDto,
  PaginatedDineInPaymentsResponseDto,
} from './dto/dine-in-payment-response.dto';
import { RejectDineInCashPaymentDto } from './dto/reject-dine-in-cash-payment.dto';
import { DineInPaymentsService } from './dine-in-payments.service';

@ApiTags('Dine-In Payment Management')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/dine-in/payments')
export class DineInPaymentsManagementController {
  constructor(
    private readonly paymentsService: DineInPaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List Dine-In payment attempts for an owned restaurant',
  })
  @ApiOkResponse({ type: PaginatedDineInPaymentsResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    return this.paymentsService.listForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      query,
    );
  }

  @Get('cash-pending')
  @ApiOperation({ summary: 'List cash requests awaiting manager confirmation' })
  @ApiOkResponse({ type: PaginatedDineInPaymentsResponseDto })
  async cashPending(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    return this.paymentsService.listCashPendingForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      query,
    );
  }

  @Get(':paymentId')
  @ApiOperation({ summary: 'Get a Dine-In payment for an owned restaurant' })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.getForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      paymentId,
    );
  }

  @Post(':paymentId/confirm-cash')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Confirm that cash for a Dine-In invoice was received',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  @ApiConflictResponse({ description: 'CASH_CONFIRMATION_NOT_ALLOWED.' })
  async confirmCash(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.confirmCash(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      paymentId,
    );
  }

  @Post(':paymentId/reject-cash')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Reject a cash request and keep the invoice payable',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  async rejectCash(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: RejectDineInCashPaymentDto,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.rejectCash(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      paymentId,
      dto,
    );
  }
}
