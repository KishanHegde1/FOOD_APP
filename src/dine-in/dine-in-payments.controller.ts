import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
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
  ApiHeader,
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
import { DineInPaymentListQueryDto } from './dto/dine-in-payment-list-query.dto';
import {
  DineInPaymentResponseDto,
  PaginatedDineInPaymentsResponseDto,
} from './dto/dine-in-payment-response.dto';
import { InitiateDineInPaymentDto } from './dto/initiate-dine-in-payment.dto';
import { VerifyDineInPaymentDto } from './dto/verify-dine-in-payment.dto';
import { DineInPaymentsService } from './dine-in-payments.service';

@ApiTags('Dine-In Payments')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('dine-in')
export class DineInPaymentsController {
  constructor(
    private readonly paymentsService: DineInPaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Get('invoices/:invoiceId/payment')
  @ApiOperation({
    summary: 'Get the latest payment attempt for a Dine-In invoice',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  @ApiNotFoundResponse({
    description: 'INVOICE_NOT_FOUND or PAYMENT_NOT_FOUND.',
  })
  async getForInvoice(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.getForInvoice(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      invoiceId,
    );
  }

  @Post('invoices/:invoiceId/payments')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Initiate CASH, UPI, or CARD payment from the trusted invoice total',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Stable client-generated key, up to 128 characters.',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'A valid Idempotency-Key and supported method are required.',
  })
  @ApiConflictResponse({
    description:
      'INVOICE_NOT_PAYMENT_PENDING, INVOICE_ALREADY_PAID, or DUPLICATE_PAYMENT_ATTEMPT.',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many payment attempts.' })
  async initiate(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('invoiceId', new ParseUUIDPipe()) invoiceId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: InitiateDineInPaymentDto,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.initiate(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      invoiceId,
      dto,
      this.requireIdempotencyKey(idempotencyKey),
    );
  }

  @Get('payments')
  @ApiOperation({
    summary: 'List the authenticated customer’s Dine-In payment history',
  })
  @ApiOkResponse({ type: PaginatedDineInPaymentsResponseDto })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Query() query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    return this.paymentsService.listForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      query,
    );
  }

  @Get('payments/:paymentId')
  @ApiOperation({
    summary: 'Get a Dine-In payment status without sensitive gateway data',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.getForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
    );
  }

  @Post('payments/:paymentId/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Verify a Razorpay UPI/Card checkout callback against stored gateway data',
  })
  @ApiOkResponse({ type: DineInPaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'INVALID_GATEWAY_SIGNATURE or PAYMENT_VERIFICATION_FAILED.',
  })
  @ApiConflictResponse({ description: 'PAYMENT_ALREADY_PROCESSING.' })
  async verify(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: VerifyDineInPaymentDto,
  ): Promise<DineInPaymentResponseDto> {
    return this.paymentsService.verify(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
      dto,
    );
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128)
      throw new BadRequestException(
        'Idempotency-Key is required and must be at most 128 characters.',
      );
    return key;
  }
}
