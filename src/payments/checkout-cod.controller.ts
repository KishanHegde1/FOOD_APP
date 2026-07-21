import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { CurrentFirebaseUser } from '../auth/decorators/current-firebase-user.decorator';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import type { FirebaseUser } from '../auth/interfaces/firebase-user.interface';
import { UsersService } from '../users/users.service';
import { OrderPlacementResponseDto } from './dto/order-placement-response.dto';
import { PlaceCodOrderDto } from './dto/place-cod-order.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Checkout')
@ApiBearerAuth('firebase-auth')
@UseGuards(FirebaseAuthGuard)
@Controller('checkout')
export class CheckoutCodController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly usersService: UsersService,
  ) {}

  @Post('cod')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Place a food-delivery Cash on Delivery order' })
  @ApiHeader({
    name: 'X-Idempotency-Key',
    required: false,
    description:
      'Preferred stable client-generated key. Body idempotencyKey is accepted for compatibility.',
  })
  @ApiOkResponse({ type: OrderPlacementResponseDto })
  @ApiBadRequestResponse({ description: 'CART_EMPTY or validation failure.' })
  @ApiConflictResponse({ description: 'DUPLICATE_CHECKOUT_REQUEST.' })
  @ApiTooManyRequestsResponse({ description: 'Too many checkout attempts.' })
  async placeCodOrder(
    @CurrentFirebaseUser() firebaseUser: FirebaseUser,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Headers('x-idempotency-key') xIdempotencyKey: string | undefined,
    @Body() dto: PlaceCodOrderDto,
  ): Promise<OrderPlacementResponseDto> {
    return this.paymentsService.placeCodOrder(
      await this.usersService.findActiveByFirebaseUid(firebaseUser.uid),
      dto,
      this.requireIdempotencyKey(
        idempotencyKey ?? xIdempotencyKey ?? dto.idempotencyKey,
      ),
    );
  }

  private requireIdempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException(
        'X-Idempotency-Key is required and must be at most 128 characters.',
      );
    }
    return key;
  }
}
