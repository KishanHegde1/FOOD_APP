import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { Address } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { Cart } from '../cart/entities/cart.entity';
import { DineInPayment as Payment } from '../dine-in/entities/dine-in-payment.entity';
import { Order } from '../dine-in/entities/order.entity';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '../dine-in/enums/order.enums';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { CompatiblePaymentOrderDto } from './dto/compatible-payment-order.dto';
import { CompatiblePaymentVerifyDto } from './dto/compatible-payment-verify.dto';
import {
  OrderPlacementResponseDto,
  OrderPlacementSummaryDto,
} from './dto/order-placement-response.dto';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';
import { PlaceCodOrderDto } from './dto/place-cod-order.dto';
import {
  PaginatedPaymentResponseDto,
  PaymentResponseDto,
} from './dto/payment-response.dto';
import { RecordPaymentFailureDto } from './dto/record-payment-failure.dto';
import { RetryRazorpayPaymentDto } from './dto/retry-razorpay-payment.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { PaymentsRepository } from './payments.repository';
import { RazorpayDeliveryGatewayService } from './razorpay-delivery-gateway.service';

export type RazorpayDeliveryWebhookPayload = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string | null;
        amount?: number;
        currency?: string;
        status?: string;
        captured?: boolean;
        error_code?: string | null;
        error_description?: string | null;
      };
    };
  };
};

type PaymentAttempt = {
  payment: Payment;
  order: Order;
  reused: boolean;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepository: PaymentsRepository,
    private readonly addressesService: AddressesService,
    private readonly razorpayGateway: RazorpayDeliveryGatewayService,
  ) {}

  async createRazorpayOrder(
    user: User,
    dto: CreateRazorpayOrderDto,
    idempotencyKey: string,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    this.ensureOnlineMethod(dto.method);
    const address = await this.addressesService.findActiveAddressForUser(
      user,
      dto.deliveryAddressId,
    );
    const attempt = await this.createDeliveryAttempt(
      user,
      address,
      dto,
      idempotencyKey,
    );
    if (attempt.reused) return this.toResponse(attempt.payment, attempt.order);
    return this.createGatewayOrder(attempt.payment.id);
  }

  async createFromCompatibleRequest(
    user: User,
    dto: CompatiblePaymentOrderDto,
    idempotencyKey: string,
  ): Promise<PaymentResponseDto | OrderPlacementResponseDto> {
    const method = this.parsePaymentMethod(dto.paymentMethod ?? dto.method);
    const addressId = this.requireAddressId(
      dto.addressId ?? dto.deliveryAddressId,
    );
    if (method === PaymentMethod.CASH_ON_DELIVERY) {
      return this.placeCodOrder(
        user,
        {
          addressId,
          couponCode: dto.couponCode,
          deliveryInstructions: dto.deliveryInstructions,
        },
        idempotencyKey,
      );
    }
    this.validateUpiIdIfPresent(method, dto.upiId);
    this.ensureOnlineMethod(method);
    return this.createRazorpayOrder(
      user,
      {
        deliveryAddressId: addressId,
        method: method as PaymentMethod.UPI | PaymentMethod.CARD,
        deliveryInstructions: dto.deliveryInstructions ?? undefined,
      },
      idempotencyKey,
    );
  }

  async placeCodOrder(
    user: User,
    dto: PlaceCodOrderDto,
    idempotencyKey: string,
  ): Promise<OrderPlacementResponseDto> {
    this.ensureCustomer(user);
    const address = await this.addressesService.findActiveAddressForUser(
      user,
      this.requireAddressId(dto.addressId ?? dto.deliveryAddressId),
    );
    const result = await this.paymentsRepository.transaction(
      async (manager) => {
        const sameRequest =
          await this.paymentsRepository.findByUserAndIdempotency(
            user.id,
            idempotencyKey,
            manager,
          );
        if (sameRequest) {
          const order = await this.requireOrder(
            sameRequest.orderId ?? '',
            manager,
          );
          return { order, payment: sameRequest };
        }
        const cart = await this.paymentsRepository.lockCartForUser(
          user.id,
          manager,
        );
        this.ensureCartReady(cart);
        const restaurant = cart.restaurant ?? cart.items[0].food.restaurant;
        this.ensureRestaurantReady(restaurant);
        this.ensureCartRestaurantConsistency(cart);
        const order = await this.createOrderFromCart(
          user,
          address,
          cart,
          restaurant,
          PaymentMethod.CASH_ON_DELIVERY,
          dto.deliveryInstructions ?? undefined,
          manager,
        );
        const payment = await this.paymentsRepository.savePayment(
          this.paymentsRepository.createPayment(
            {
              paymentReference: this.paymentReference(),
              orderId: order.id,
              invoiceId: null,
              dineInSessionId: null,
              userId: user.id,
              restaurantId: restaurant.id,
              method: PaymentMethod.CASH_ON_DELIVERY,
              status: PaymentStatus.PENDING,
              amountPaise: order.grandTotalPaise,
              currency: 'INR',
              gateway: 'COD',
              gatewayOrderId: null,
              gatewayPaymentId: null,
              gatewaySignature: null,
              gatewayEventId: null,
              transactionReference: null,
              idempotencyKey,
              failureCode: null,
              failureReason: null,
              initiatedAt: new Date(),
              completedAt: null,
              failedAt: null,
              paidAt: null,
              refundedAt: null,
            },
            manager,
          ),
          manager,
        );
        await this.paymentsRepository.deleteCartItemsForUser(user.id, manager);
        await this.log(
          {
            eventType: 'COD_ORDER_PLACED',
            paymentId: payment.id,
            orderId: order.id,
            userId: user.id,
            statusTo: PaymentStatus.PENDING,
            gateway: 'COD',
          },
          manager,
        );
        return { order, payment };
      },
    );
    return this.toOrderPlacementResponse(result.order);
  }

  async retry(
    user: User,
    paymentId: string,
    dto: RetryRazorpayPaymentDto,
    idempotencyKey: string,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    this.ensureOnlineMethod(dto.method);
    const original = await this.paymentsRepository.findPaymentForCustomer(
      paymentId,
      user.id,
    );
    if (!original) throw new NotFoundException('PAYMENT_NOT_FOUND');
    if (
      ![PaymentStatus.FAILED, PaymentStatus.EXPIRED].includes(original.status)
    ) {
      throw new ConflictException('PAYMENT_NOT_RETRYABLE');
    }
    if (!original.orderId) throw new NotFoundException('ORDER_NOT_FOUND');

    const attempt = await this.paymentsRepository.transaction(
      async (manager) => {
        const sameRequest =
          await this.paymentsRepository.findByUserAndIdempotency(
            user.id,
            idempotencyKey,
            manager,
          );
        if (sameRequest) {
          const order = await this.requireOrder(
            sameRequest.orderId ?? '',
            manager,
          );
          return { payment: sameRequest, order, reused: true };
        }
        const order = await this.requireOrder(original.orderId ?? '', manager);
        this.ensureRetryableOrder(order);
        if (
          await this.paymentsRepository.findSuccessfulForOrder(
            order.id,
            manager,
          )
        ) {
          throw new ConflictException('ORDER_ALREADY_PAID');
        }
        if (
          await this.paymentsRepository.findOpenForCustomer(user.id, manager)
        ) {
          throw new ConflictException('DUPLICATE_PAYMENT_ATTEMPT');
        }
        const now = new Date();
        const payment = this.paymentsRepository.createPayment(
          {
            paymentReference: this.paymentReference(),
            orderId: order.id,
            invoiceId: null,
            dineInSessionId: null,
            userId: user.id,
            restaurantId: order.restaurantId,
            method: dto.method,
            status: PaymentStatus.PROCESSING,
            amountPaise: order.grandTotalPaise,
            currency: 'INR',
            gateway: 'RAZORPAY',
            gatewayOrderId: null,
            gatewayPaymentId: null,
            gatewaySignature: null,
            gatewayEventId: null,
            transactionReference: null,
            idempotencyKey,
            failureCode: null,
            failureReason: null,
            initiatedAt: now,
            completedAt: null,
            failedAt: null,
            paidAt: null,
            refundedAt: null,
          },
          manager,
        );
        await this.log(
          {
            eventType: 'PAYMENT_RETRY_CREATED',
            paymentId: payment.id,
            orderId: order.id,
            userId: user.id,
            statusTo: PaymentStatus.PROCESSING,
            gateway: 'RAZORPAY',
          },
          manager,
        );
        return {
          payment: await this.paymentsRepository.savePayment(payment, manager),
          order,
          reused: false,
        };
      },
    );

    if (attempt.reused) return this.toResponse(attempt.payment, attempt.order);
    return this.createGatewayOrder(attempt.payment.id);
  }

  async verify(
    user: User,
    paymentId: string,
    dto: VerifyRazorpayPaymentDto,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    const payment = await this.paymentsRepository.findPaymentForCustomer(
      paymentId,
      user.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    const order = await this.requireOrder(payment.orderId ?? '');
    if (payment.status === PaymentStatus.SUCCESS) {
      return this.toResponse(payment, order);
    }
    this.ensureVerifiablePayment(payment, dto.gatewayOrderId);
    if (
      !this.razorpayGateway.verifyCheckoutSignature({
        orderId: dto.gatewayOrderId,
        paymentId: dto.gatewayPaymentId,
        signature: dto.gatewaySignature,
      })
    ) {
      throw new BadRequestException('INVALID_GATEWAY_SIGNATURE');
    }

    const gatewayPayment = await this.razorpayGateway.fetchPayment(
      dto.gatewayPaymentId,
    );
    if (!this.isCapturedGatewayPayment(payment, gatewayPayment)) {
      throw new ConflictException('PAYMENT_VERIFICATION_FAILED');
    }

    return this.completePayment(payment.id, {
      gatewayPaymentId: gatewayPayment.id,
      gatewaySignature: dto.gatewaySignature,
      transactionReference: gatewayPayment.id,
      eventType: 'PAYMENT_VERIFIED',
    });
  }

  async verifyByGatewayReference(
    user: User,
    dto: CompatiblePaymentVerifyDto,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    const gatewayOrderId = this.requiredText(
      dto.razorpayOrderId ?? dto.gatewayOrderId,
      'PAYMENT_VERIFICATION_FAILED',
    );
    const gatewayPaymentId = this.requiredText(
      dto.razorpayPaymentId ?? dto.gatewayPaymentId,
      'PAYMENT_VERIFICATION_FAILED',
    );
    const gatewaySignature = this.requiredText(
      dto.razorpaySignature ?? dto.gatewaySignature,
      'PAYMENT_VERIFICATION_FAILED',
    );
    const payment =
      await this.paymentsRepository.findByGatewayOrderId(gatewayOrderId);
    if (!payment || payment.userId !== user.id) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }
    return this.verify(user, payment.id, {
      gatewayOrderId,
      gatewayPaymentId,
      gatewaySignature,
    });
  }

  async recordFailure(
    user: User,
    paymentId: string,
    dto: RecordPaymentFailureDto,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    const payment = await this.paymentsRepository.findPaymentForCustomer(
      paymentId,
      user.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.failPayment(
      payment.id,
      dto.code ?? 'PAYMENT_FAILED',
      dto.reason ?? 'Payment failed or was cancelled.',
      dto.gatewayPaymentId,
      'PAYMENT_FAILURE_RECORDED',
    );
  }

  async getForCustomer(
    user: User,
    paymentId: string,
  ): Promise<PaymentResponseDto> {
    this.ensureCustomer(user);
    const payment = await this.paymentsRepository.findPaymentForCustomer(
      paymentId,
      user.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.toResponse(
      payment,
      await this.requireOrder(payment.orderId ?? ''),
    );
  }

  async listForCustomer(
    user: User,
    query: PaymentHistoryQueryDto,
  ): Promise<PaginatedPaymentResponseDto> {
    this.ensureCustomer(user);
    const result = await this.paymentsRepository.listForCustomer(
      user.id,
      query,
    );
    return {
      items: await Promise.all(
        result.items.map(async (payment) =>
          this.toResponse(
            payment,
            await this.requireOrder(payment.orderId ?? ''),
          ),
        ),
      ),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  async handleRazorpayWebhook(input: {
    rawBody: string;
    signature: string;
    eventId: string | undefined;
    payload: RazorpayDeliveryWebhookPayload;
  }): Promise<void> {
    if (
      !this.razorpayGateway.verifyWebhookSignature(
        input.rawBody,
        input.signature,
      )
    ) {
      throw new ForbiddenException('WEBHOOK_SIGNATURE_INVALID');
    }
    if (
      input.eventId &&
      (await this.paymentsRepository.findWebhookEvent(input.eventId))
    ) {
      return;
    }

    const entity = input.payload.payload?.payment?.entity;
    const eventType = input.payload.event ?? 'unknown';
    const webhook = await this.saveWebhookEvent({
      eventId: input.eventId ?? null,
      eventType,
      gatewayOrderId: entity?.order_id ?? null,
      gatewayPaymentId: entity?.id ?? null,
      payload: input.payload,
      processed: false,
      ignoredReason: null,
    });

    if (!entity?.order_id || !entity.id) {
      await this.markWebhookIgnored(webhook.id, 'PAYMENT_ENTITY_MISSING');
      return;
    }
    const payment = await this.paymentsRepository.findByGatewayOrderId(
      entity.order_id,
    );
    if (!payment || payment.invoiceId || payment.dineInSessionId) {
      await this.markWebhookIgnored(webhook.id, 'DELIVERY_PAYMENT_NOT_FOUND');
      return;
    }

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      if (
        entity.amount !== payment.amountPaise ||
        entity.currency !== payment.currency ||
        entity.status !== 'captured' ||
        !entity.captured
      ) {
        await this.markWebhookIgnored(webhook.id, 'PAYMENT_AMOUNT_MISMATCH');
        return;
      }
      await this.completePayment(payment.id, {
        gatewayPaymentId: entity.id,
        gatewayEventId: input.eventId,
        transactionReference: entity.id,
        eventType: 'PAYMENT_WEBHOOK_CAPTURED',
      });
      await this.markWebhookProcessed(webhook.id, payment.id);
      return;
    }

    if (eventType === 'payment.failed') {
      await this.failPayment(
        payment.id,
        entity.error_code ?? 'PAYMENT_FAILED',
        entity.error_description ?? 'Payment failed at the gateway.',
        entity.id,
        'PAYMENT_WEBHOOK_FAILED',
        input.eventId,
      );
      await this.markWebhookProcessed(webhook.id, payment.id);
      return;
    }

    await this.markWebhookIgnored(webhook.id, 'EVENT_NOT_HANDLED');
  }

  private async createDeliveryAttempt(
    user: User,
    address: Address,
    dto: CreateRazorpayOrderDto,
    idempotencyKey: string,
  ): Promise<PaymentAttempt> {
    return this.paymentsRepository.transaction(async (manager) => {
      const sameRequest =
        await this.paymentsRepository.findByUserAndIdempotency(
          user.id,
          idempotencyKey,
          manager,
        );
      if (sameRequest) {
        const order = await this.requireOrder(
          sameRequest.orderId ?? '',
          manager,
        );
        return { payment: sameRequest, order, reused: true };
      }
      if (await this.paymentsRepository.findOpenForCustomer(user.id, manager)) {
        throw new ConflictException('DUPLICATE_PAYMENT_ATTEMPT');
      }
      const cart = await this.paymentsRepository.lockCartForUser(
        user.id,
        manager,
      );
      this.ensureCartReady(cart);
      const restaurant = cart.restaurant ?? cart.items[0].food.restaurant;
      this.ensureRestaurantReady(restaurant);
      this.ensureCartRestaurantConsistency(cart);
      const order = await this.createOrderFromCart(
        user,
        address,
        cart,
        restaurant,
        dto.method,
        dto.deliveryInstructions,
        manager,
      );
      const now = new Date();
      const payment = this.paymentsRepository.createPayment(
        {
          paymentReference: this.paymentReference(),
          orderId: order.id,
          invoiceId: null,
          dineInSessionId: null,
          userId: user.id,
          restaurantId: restaurant.id,
          method: dto.method,
          status: PaymentStatus.PROCESSING,
          amountPaise: order.grandTotalPaise,
          currency: 'INR',
          gateway: 'RAZORPAY',
          gatewayOrderId: null,
          gatewayPaymentId: null,
          gatewaySignature: null,
          gatewayEventId: null,
          transactionReference: null,
          idempotencyKey,
          failureCode: null,
          failureReason: null,
          initiatedAt: now,
          completedAt: null,
          failedAt: null,
          paidAt: null,
          refundedAt: null,
        },
        manager,
      );
      await this.log(
        {
          eventType: 'PAYMENT_ATTEMPT_CREATED',
          paymentId: payment.id,
          orderId: order.id,
          userId: user.id,
          statusTo: PaymentStatus.PROCESSING,
          gateway: 'RAZORPAY',
        },
        manager,
      );
      return {
        payment: await this.paymentsRepository.savePayment(payment, manager),
        order,
        reused: false,
      };
    });
  }

  private async createGatewayOrder(
    paymentId: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.paymentsRepository.transaction(
      async (manager) => {
        const current = await this.requirePayment(paymentId, manager);
        if (current.status !== PaymentStatus.PROCESSING) return current;
        return current;
      },
    );
    const order = await this.requireOrder(payment.orderId ?? '');

    try {
      const gatewayOrder = await this.razorpayGateway.createOrder({
        amountPaise: payment.amountPaise,
        currency: payment.currency,
        receipt: payment.paymentReference ?? payment.id,
        paymentReference: payment.paymentReference ?? payment.id,
        orderId: order.id,
        userId: payment.userId,
      });
      if (
        gatewayOrder.amount !== payment.amountPaise ||
        gatewayOrder.currency !== payment.currency
      ) {
        return this.failPayment(
          payment.id,
          'PAYMENT_AMOUNT_MISMATCH',
          'Gateway order amount did not match the trusted order amount.',
          undefined,
          'PAYMENT_GATEWAY_AMOUNT_MISMATCH',
        );
      }
      const saved = await this.paymentsRepository.transaction(
        async (manager) => {
          const locked = await this.requirePayment(payment.id, manager);
          if (locked.status !== PaymentStatus.PROCESSING) return locked;
          const previousStatus = locked.status;
          locked.gatewayOrderId = gatewayOrder.id;
          locked.status = PaymentStatus.PENDING;
          await this.log(
            {
              eventType: 'RAZORPAY_ORDER_CREATED',
              paymentId: locked.id,
              orderId: locked.orderId,
              userId: locked.userId,
              statusFrom: previousStatus,
              statusTo: locked.status,
              gateway: 'RAZORPAY',
              gatewayOrderId: gatewayOrder.id,
            },
            manager,
          );
          return this.paymentsRepository.savePayment(locked, manager);
        },
      );
      return this.toResponse(saved, order);
    } catch (error) {
      this.logger.error(
        `Razorpay order creation failed for payment ${payment.id}: ${this.safeErrorMessage(error)}`,
      );
      if (error instanceof HttpException) throw error;
      if (error instanceof BadGatewayException) throw error;
      return this.failPayment(
        payment.id,
        'GATEWAY_ORDER_CREATION_FAILED',
        'Unable to create the payment gateway order.',
        undefined,
        'PAYMENT_GATEWAY_ORDER_CREATION_FAILED',
      );
    }
  }

  private async createOrderFromCart(
    user: User,
    address: Address,
    cart: Cart,
    restaurant: Restaurant,
    method: PaymentMethod,
    deliveryInstructions: string | undefined,
    manager: EntityManager,
  ): Promise<Order> {
    const subtotalPaise = cart.items.reduce(
      (total, item) => total + item.food.pricePaise * item.quantity,
      0,
    );
    if (subtotalPaise < restaurant.minimumOrderPaise) {
      throw new BadRequestException('MINIMUM_ORDER_NOT_MET');
    }
    const deliveryFeePaise = restaurant.deliveryFeePaise;
    const taxPaise = 0;
    const platformFeePaise = 0;
    const discountPaise = 0;
    const order = await this.paymentsRepository.saveOrder(
      this.paymentsRepository.createOrder(
        {
          orderNumber: this.orderNumber(),
          customerId: user.id,
          restaurantId: restaurant.id,
          deliveryPartnerId: null,
          deliveryAddressId: address.id,
          recipientNameSnapshot: address.recipientName,
          recipientPhoneSnapshot: address.phone,
          deliveryAddressSnapshot: this.formatAddress(address),
          deliveryLatitude: address.latitude,
          deliveryLongitude: address.longitude,
          itemTotalPaise: subtotalPaise,
          deliveryFeePaise,
          platformFeePaise,
          taxPaise,
          discountPaise,
          grandTotalPaise:
            subtotalPaise + deliveryFeePaise + platformFeePaise + taxPaise,
          paymentMethod: method,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PLACED,
          couponCode: cart.couponCode,
          deliveryInstructions: deliveryInstructions?.trim() || null,
          cancellationReason: null,
          estimatedDeliveryAt: new Date(
            Date.now() + restaurant.averageDeliveryMinutes * 60_000,
          ),
          orderType: OrderType.DELIVERY,
          dineInSessionId: null,
          restaurantTableId: null,
          orderRoundNumber: null,
          dineInStatus: null,
        },
        manager,
      ),
      manager,
    );
    await this.paymentsRepository.saveOrderItems(
      cart.items.map((item) =>
        this.paymentsRepository.createOrderItem(
          {
            orderId: order.id,
            foodItemId: item.food.id,
            foodNameSnapshot: item.food.name,
            foodDescriptionSnapshot: item.food.description,
            foodImageSnapshot: item.food.imageUrl,
            unitPricePaise: item.food.pricePaise,
            quantity: item.quantity,
            subtotalPaise: item.food.pricePaise * item.quantity,
            instructions: item.instructions,
          },
          manager,
        ),
      ),
      manager,
    );
    await this.paymentsRepository.saveStatusHistory(
      this.paymentsRepository.createStatusHistory(
        {
          orderId: order.id,
          previousStatus: null,
          newStatus: OrderStatus.PLACED,
          changedByUserId: user.id,
          note: 'Delivery order created for Razorpay payment.',
        },
        manager,
      ),
      manager,
    );
    return order;
  }

  private async completePayment(
    paymentId: string,
    updates: {
      gatewayPaymentId: string;
      gatewaySignature?: string;
      gatewayEventId?: string;
      transactionReference: string;
      eventType: string;
    },
  ): Promise<PaymentResponseDto> {
    const result = await this.paymentsRepository.transaction(
      async (manager) => {
        const payment = await this.requirePayment(paymentId, manager);
        const order = await this.requireOrder(payment.orderId ?? '', manager);
        this.ensurePaymentOrderPair(payment, order);
        if (payment.status === PaymentStatus.SUCCESS) return { payment, order };
        if (
          await this.paymentsRepository.findSuccessfulForOrder(
            order.id,
            manager,
          )
        ) {
          throw new ConflictException('ORDER_ALREADY_PAID');
        }
        const previousPaymentStatus = payment.status;
        const previousOrderPaymentStatus = order.paymentStatus;
        const now = new Date();
        payment.status = PaymentStatus.SUCCESS;
        payment.gatewayPaymentId = updates.gatewayPaymentId;
        payment.gatewaySignature =
          updates.gatewaySignature ?? payment.gatewaySignature;
        payment.gatewayEventId =
          updates.gatewayEventId ?? payment.gatewayEventId;
        payment.transactionReference = updates.transactionReference;
        payment.completedAt = now;
        payment.paidAt = now;
        payment.failedAt = null;
        payment.failureCode = null;
        payment.failureReason = null;
        order.paymentStatus = PaymentStatus.SUCCESS;
        await this.paymentsRepository.deleteCartItemsForUser(
          payment.userId,
          manager,
        );
        await this.log(
          {
            eventType: updates.eventType,
            paymentId: payment.id,
            orderId: order.id,
            userId: payment.userId,
            statusFrom: previousPaymentStatus,
            statusTo: payment.status,
            gateway: 'RAZORPAY',
            gatewayOrderId: payment.gatewayOrderId,
            gatewayPaymentId: payment.gatewayPaymentId,
            metadata: { previousOrderPaymentStatus },
          },
          manager,
        );
        return {
          payment: await this.paymentsRepository.savePayment(payment, manager),
          order: await this.paymentsRepository.saveOrder(order, manager),
        };
      },
    );
    return this.toResponse(result.payment, result.order);
  }

  private async failPayment(
    paymentId: string,
    code: string,
    reason: string,
    gatewayPaymentId: string | undefined,
    eventType: string,
    gatewayEventId?: string,
  ): Promise<PaymentResponseDto> {
    const result = await this.paymentsRepository.transaction(
      async (manager) => {
        const payment = await this.requirePayment(paymentId, manager);
        const order = await this.requireOrder(payment.orderId ?? '', manager);
        if (payment.status === PaymentStatus.SUCCESS) return { payment, order };
        const previousStatus = payment.status;
        payment.status = PaymentStatus.FAILED;
        payment.failureCode = code;
        payment.failureReason = reason;
        payment.gatewayPaymentId = gatewayPaymentId ?? payment.gatewayPaymentId;
        payment.gatewayEventId = gatewayEventId ?? payment.gatewayEventId;
        payment.failedAt = new Date();
        order.paymentStatus = PaymentStatus.FAILED;
        await this.log(
          {
            eventType,
            paymentId: payment.id,
            orderId: order.id,
            userId: payment.userId,
            statusFrom: previousStatus,
            statusTo: payment.status,
            gateway: 'RAZORPAY',
            gatewayOrderId: payment.gatewayOrderId,
            gatewayPaymentId: payment.gatewayPaymentId,
            metadata: { code, reason },
          },
          manager,
        );
        return {
          payment: await this.paymentsRepository.savePayment(payment, manager),
          order: await this.paymentsRepository.saveOrder(order, manager),
        };
      },
    );
    return this.toResponse(result.payment, result.order);
  }

  private async saveWebhookEvent(input: {
    eventId: string | null;
    eventType: string;
    gatewayOrderId: string | null;
    gatewayPaymentId: string | null;
    payload: Record<string, unknown>;
    processed: boolean;
    ignoredReason: string | null;
  }) {
    try {
      return await this.paymentsRepository.saveWebhookEvent({
        gateway: 'RAZORPAY',
        ...input,
      });
    } catch (error) {
      if (this.isUniqueViolation(error) && input.eventId) {
        throw new ConflictException('WEBHOOK_ALREADY_PROCESSED');
      }
      throw error;
    }
  }

  private async markWebhookProcessed(
    webhookId: string,
    paymentId: string,
  ): Promise<void> {
    await this.paymentsRepository.transaction(async (manager) => {
      await this.paymentsRepository.updateWebhookEvent(
        webhookId,
        { processed: true, paymentId },
        manager,
      );
    });
  }

  private async markWebhookIgnored(
    webhookId: string,
    reason: string,
  ): Promise<void> {
    await this.paymentsRepository.transaction(async (manager) => {
      await this.paymentsRepository.updateWebhookEvent(
        webhookId,
        { processed: false, ignoredReason: reason },
        manager,
      );
    });
  }

  private async requirePayment(
    id: string,
    manager: EntityManager,
  ): Promise<Payment> {
    const payment = await this.paymentsRepository.lockPayment(id, manager);
    if (!payment || payment.invoiceId || payment.dineInSessionId) {
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    }
    return payment;
  }

  private async requireOrder(
    id: string,
    manager?: EntityManager,
  ): Promise<Order> {
    const order = manager
      ? await this.paymentsRepository.lockOrder(id, manager)
      : await this.paymentsRepository.findOrderById(id);
    if (!order || order.orderType !== OrderType.DELIVERY) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }
    return order;
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive || user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException(
        'Only active customers can manage payments.',
      );
    }
  }

  private ensureOnlineMethod(method: PaymentMethod): void {
    if (![PaymentMethod.UPI, PaymentMethod.CARD].includes(method)) {
      throw new BadRequestException('PAYMENT_METHOD_NOT_SUPPORTED');
    }
  }

  private parsePaymentMethod(value: string | undefined): PaymentMethod {
    const method = value?.trim().toUpperCase();
    if (method === 'UPI') return PaymentMethod.UPI;
    if (
      method === 'CARD' ||
      method === 'CREDIT_CARD' ||
      method === 'DEBIT_CARD'
    ) {
      return PaymentMethod.CARD;
    }
    if (method === 'COD' || method === 'CASH_ON_DELIVERY') {
      return PaymentMethod.CASH_ON_DELIVERY;
    }
    throw new BadRequestException('INVALID_PAYMENT_METHOD');
  }

  private requireAddressId(value: string | undefined): string {
    const addressId = value?.trim();
    if (!addressId) throw new BadRequestException('ADDRESS_NOT_FOUND');
    return addressId;
  }

  private validateUpiIdIfPresent(
    method: PaymentMethod,
    upiId: string | undefined,
  ): void {
    const value = upiId?.trim();
    if (method !== PaymentMethod.UPI || !value) return;
    if (
      /\s/.test(value) ||
      !/^[A-Za-z0-9.\-_]{2,256}@[A-Za-z][A-Za-z0-9.\-_]{1,64}$/.test(value)
    ) {
      throw new BadRequestException('INVALID_UPI_ID');
    }
  }

  private ensureCartReady(cart: Cart | null): asserts cart is Cart {
    if (!cart || !cart.items || cart.items.length === 0) {
      throw new BadRequestException('CART_EMPTY');
    }
    if (cart.items.some((item) => item.quantity < 1 || item.quantity > 20)) {
      throw new BadRequestException('INVALID_ITEM_QUANTITY');
    }
    if (
      cart.items.some((item) => !item.food.isActive || !item.food.isAvailable)
    ) {
      throw new BadRequestException('ITEM_UNAVAILABLE');
    }
  }

  private ensureRestaurantReady(restaurant: Restaurant): void {
    if (
      !restaurant.isActive ||
      restaurant.status !== RestaurantStatus.APPROVED
    ) {
      throw new BadRequestException('RESTAURANT_UNAVAILABLE');
    }
    if (!restaurant.isOpen) throw new BadRequestException('RESTAURANT_CLOSED');
  }

  private ensureCartRestaurantConsistency(cart: Cart): void {
    if (
      !cart.restaurantId ||
      cart.items.some((item) => item.food.restaurantId !== cart.restaurantId)
    ) {
      throw new BadRequestException('CART_RESTAURANT_MISMATCH');
    }
  }

  private ensureVerifiablePayment(
    payment: Payment,
    gatewayOrderId: string,
  ): void {
    if (![PaymentMethod.UPI, PaymentMethod.CARD].includes(payment.method)) {
      throw new ConflictException('PAYMENT_METHOD_NOT_SUPPORTED');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new ConflictException('PAYMENT_ALREADY_PROCESSING');
    }
    if (!payment.gatewayOrderId || payment.gatewayOrderId !== gatewayOrderId) {
      throw new BadRequestException('PAYMENT_VERIFICATION_FAILED');
    }
  }

  private isCapturedGatewayPayment(
    payment: Payment,
    gatewayPayment: {
      order_id: string | null;
      amount: number;
      currency: string;
      status: string;
      captured: boolean;
    },
  ): boolean {
    return (
      gatewayPayment.order_id === payment.gatewayOrderId &&
      gatewayPayment.amount === payment.amountPaise &&
      gatewayPayment.currency === payment.currency &&
      gatewayPayment.status === 'captured' &&
      gatewayPayment.captured
    );
  }

  private ensurePaymentOrderPair(payment: Payment, order: Order): void {
    if (
      payment.orderId !== order.id ||
      payment.userId !== order.customerId ||
      payment.restaurantId !== order.restaurantId ||
      payment.invoiceId ||
      payment.dineInSessionId
    ) {
      throw new ConflictException('PAYMENT_VERIFICATION_FAILED');
    }
  }

  private ensureRetryableOrder(order: Order): void {
    if (order.paymentStatus === PaymentStatus.SUCCESS) {
      throw new ConflictException('ORDER_ALREADY_PAID');
    }
    if (order.orderStatus === OrderStatus.CANCELLED) {
      throw new ConflictException('ORDER_CANCELLED');
    }
  }

  private toResponse(payment: Payment, order: Order): PaymentResponseDto {
    const canCheckout =
      payment.gateway === 'RAZORPAY' &&
      payment.gatewayOrderId &&
      payment.status === PaymentStatus.PENDING &&
      [PaymentMethod.UPI, PaymentMethod.CARD].includes(payment.method);
    return {
      id: payment.id,
      paymentReference: payment.paymentReference ?? payment.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      restaurantId: order.restaurantId,
      method: payment.method,
      status: payment.status,
      orderStatus: order.orderStatus,
      orderPaymentStatus: order.paymentStatus,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      transactionReference: payment.transactionReference,
      failure:
        payment.failureCode || payment.failureReason
          ? { code: payment.failureCode, reason: payment.failureReason }
          : null,
      initiatedAt: (payment.initiatedAt ?? payment.createdAt).toISOString(),
      completedAt: payment.completedAt?.toISOString() ?? null,
      ...(canCheckout
        ? {
            checkout: {
              gateway: 'RAZORPAY' as const,
              keyId: this.razorpayGateway.getPublicKey(),
              orderId: payment.gatewayOrderId!,
              amountPaise: payment.amountPaise,
              currency: payment.currency,
              method: payment.method as PaymentMethod.UPI | PaymentMethod.CARD,
            },
          }
        : {}),
    };
  }

  private toOrderPlacementResponse(order: Order): OrderPlacementResponseDto {
    return {
      success: true,
      message: 'Order placed successfully',
      data: this.toOrderPlacementSummary(order),
    };
  }

  private toOrderPlacementSummary(order: Order): OrderPlacementSummaryDto {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod:
        order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY
          ? 'COD'
          : (order.paymentMethod as 'UPI' | 'CARD'),
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      total: order.grandTotalPaise / 100,
      totalPaise: order.grandTotalPaise,
    };
  }

  private requiredText(value: string | undefined, code: string): string {
    const text = value?.trim();
    if (!text) throw new BadRequestException(code);
    return text;
  }

  private formatAddress(address: Address): string {
    return [
      address.addressLine,
      address.locality,
      address.landmark,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ]
      .filter(Boolean)
      .join(', ');
  }

  private async log(
    input: {
      eventType: string;
      paymentId?: string | null;
      orderId?: string | null;
      userId?: string | null;
      statusFrom?: string | null;
      statusTo?: string | null;
      gateway?: string | null;
      gatewayOrderId?: string | null;
      gatewayPaymentId?: string | null;
      metadata?: Record<string, unknown> | null;
    },
    manager: EntityManager,
  ): Promise<void> {
    await this.paymentsRepository.saveTransactionLog(
      {
        paymentId: input.paymentId ?? null,
        orderId: input.orderId ?? null,
        userId: input.userId ?? null,
        eventType: input.eventType,
        statusFrom: input.statusFrom ?? null,
        statusTo: input.statusTo ?? null,
        gateway: input.gateway ?? null,
        gatewayOrderId: input.gatewayOrderId ?? null,
        gatewayPaymentId: input.gatewayPaymentId ?? null,
        metadata: input.metadata ?? null,
      },
      manager,
    );
  }

  private paymentReference(): string {
    return `DEL-PAY-${randomUUID().replace(/-/g, '').slice(0, 32).toUpperCase()}`;
  }

  private orderNumber(): string {
    return `DEL-ORD-${randomUUID().replace(/-/g, '').slice(0, 24).toUpperCase()}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return typeof error === 'string' ? error : 'Unknown payment gateway error';
  }
}
