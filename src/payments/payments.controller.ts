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
import { CompatiblePaymentOrderDto } from './dto/compatible-payment-order.dto';
import { CompatiblePaymentVerifyDto } from './dto/compatible-payment-verify.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { OrderPlacementResponseDto } from './dto/order-placement-response.dto';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';
import {
  PaginatedPaymentResponseDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import { RecordPaymentFailureDto } from './dto/record-payment-failure.dto';
import { RetryRazorpayPaymentDto } from './dto/retry-razorpay-payment.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Delivery Payments')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('razorpay/orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Create a delivery order from the trusted cart and open a Razorpay order',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Stable client-generated key, up to 128 characters.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'CART_EMPTY, RESTAURANT_CLOSED, or validation failure.',
  })
  @ApiConflictResponse({ description: 'DUPLICATE_PAYMENT_ATTEMPT.' })
  @ApiTooManyRequestsResponse({ description: 'Too many payment attempts.' })
  async createRazorpayOrder(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Body() dto: CreateRazorpayOrderDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.createRazorpayOrder(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
      this.requireIdempotencyKey(idempotencyKey ?? xIdempotencyKey),
    );
  }

  @Post('orders')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Compatibility endpoint for Flutter delivery payment order creation',
  })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description:
      'Preferred stable client-generated key. Body idempotencyKey is accepted for compatibility.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiConflictResponse({ description: 'DUPLICATE_PAYMENT_ATTEMPT.' })
  async createCompatiblePaymentOrder(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Body() dto: CompatiblePaymentOrderDto,
  ): Promise<PaymentResponseDto | OrderPlacementResponseDto> {
    return this.paymentsService.createFromCompatibleRequest(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
      this.requireIdempotencyKey(
        idempotencyKey ?? xIdempotencyKey ?? dto.idempotencyKey,
      ),
    );
  }

  @Get()
  @ApiOperation({ summary: 'List authenticated customer delivery payments' })
  @ApiOkResponse({ type: PaginatedPaymentResponseDto })
  async list(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Query() query: PaymentHistoryQueryDto,
  ): Promise<PaginatedPaymentResponseDto> {
    return this.paymentsService.listForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      query,
    );
  }

  @Get(':paymentId')
  @ApiOperation({ summary: 'Get a delivery payment status' })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiNotFoundResponse({ description: 'PAYMENT_NOT_FOUND.' })
  async get(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.getForCustomer(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
    );
  }

  @Post(':paymentId/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify Razorpay callback signature and mark delivery order paid',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'INVALID_GATEWAY_SIGNATURE or PAYMENT_VERIFICATION_FAILED.',
  })
  @ApiConflictResponse({ description: 'PAYMENT_ALREADY_PROCESSING.' })
  async verify(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: VerifyRazorpayPaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.verify(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
      dto,
    );
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Compatibility endpoint to verify Razorpay payment by gateway order ID',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiBadRequestResponse({
    description: 'INVALID_GATEWAY_SIGNATURE or PAYMENT_VERIFICATION_FAILED.',
  })
  async verifyCompatible(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Body() dto: CompatiblePaymentVerifyDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.verifyByGatewayReference(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
    );
  }

  @Post(':paymentId/failure')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record a failed or cancelled Razorpay checkout' })
  @ApiOkResponse({ type: PaymentResponseDto })
  async recordFailure(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Body() dto: RecordPaymentFailureDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.recordFailure(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
      dto,
    );
  }

  @Post(':paymentId/retry')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Retry a failed delivery payment safely' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'Stable client-generated key for this retry request.',
  })
  @ApiOkResponse({ type: PaymentResponseDto })
  @ApiConflictResponse({ description: 'PAYMENT_NOT_RETRYABLE.' })
  async retry(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Param('paymentId', new ParseUUIDPipe()) paymentId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Body() dto: RetryRazorpayPaymentDto,
  ): Promise<PaymentResponseDto> {
    return this.paymentsService.retry(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      paymentId,
      dto,
      this.requireIdempotencyKey(idempotencyKey ?? xIdempotencyKey),
    );
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key is required and must be at most 128 characters.',
      );
    }
    return key;
  }
}
