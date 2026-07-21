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
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { CancelDineInBillRequestDto } from './dto/cancel-dine-in-bill-request.dto';
import { DineInInvoiceListQueryDto } from './dto/dine-in-invoice-list-query.dto';
import {
  DineInInvoiceResponseDto,
  PaginatedDineInInvoicesResponseDto,
} from './dto/dine-in-invoice-response.dto';
import { DineInInvoicesService } from './dine-in-invoices.service';

@ApiTags('Dine-In Bill Management')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('manager/restaurants/:restaurantId/dine-in/invoices')
export class DineInInvoicesManagementController {
  constructor(
    private readonly invoicesService: DineInInvoicesService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List bills for an owned restaurant' })
  @ApiOkResponse({ type: PaginatedDineInInvoicesResponseDto })
  @ApiForbiddenResponse({ description: 'RESTAURANT_ACCESS_DENIED.' })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Query() query: DineInInvoiceListQueryDto,
  ): Promise<PaginatedDineInInvoicesResponseDto> {
    return this.invoicesService.listForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      query,
    );
  }

  @Get(':invoiceId')
  @ApiOperation({ summary: 'Get a bill for an owned restaurant' })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.getForManager(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      invoiceId,
    );
  }

  @Post(':invoiceId/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Freeze and confirm a requested bill for payment' })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  @ApiConflictResponse({
    description:
      'UNFINISHED_ORDERS_EXIST, BILL_TOTAL_MISMATCH, or INVOICE_ALREADY_CONFIRMED.',
  })
  @ApiTooManyRequestsResponse({
    description: 'Too many confirmation attempts.',
  })
  async confirm(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.confirm(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      invoiceId,
    );
  }

  @Post(':invoiceId/cancel-request')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a requested bill and reopen the session' })
  @ApiOkResponse({ type: DineInInvoiceResponseDto })
  @ApiConflictResponse({ description: 'BILL_CANCELLATION_NOT_ALLOWED.' })
  async cancelRequest(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('restaurantId', new ParseUUIDPipe()) restaurantId: string,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Body() dto: CancelDineInBillRequestDto,
  ): Promise<DineInInvoiceResponseDto> {
    return this.invoicesService.cancelRequest(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      restaurantId,
      invoiceId,
      dto,
    );
  }
}
