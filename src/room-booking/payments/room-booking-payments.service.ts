import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { RazorpayDeliveryGatewayService } from '../../payments/razorpay-delivery-gateway.service';
import { User } from '../../users/entities/user.entity';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../common/enums/room-booking.enums';
import { numericToPaise } from '../common/utils/money.util';
import { BookingStatusHistory } from '../bookings/entities/booking-status-history.entity';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { HotelBookingResponseDto } from '../bookings/dto/booking-response.dto';
import { RecordRoomBookingPaymentFailureDto } from './dto/record-room-booking-payment-failure.dto';
import { RoomBookingPaymentResponseDto } from './dto/room-booking-payment-response.dto';
import { VerifyRoomBookingPaymentDto } from './dto/verify-room-booking-payment.dto';
import { HotelBookingPayment } from './entities/hotel-booking-payment.entity';
import { HotelBookingPaymentTransactionLog } from './entities/hotel-booking-payment-transaction-log.entity';
import { HotelBookingPaymentWebhookEvent } from './entities/hotel-booking-payment-webhook-event.entity';

export type RazorpayRoomBookingWebhookPayload = {
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

type RazorpayRoomBookingPaymentEntity = NonNullable<
  NonNullable<RazorpayRoomBookingWebhookPayload['payload']>['payment']
>['entity'];

export type RoomBookingPaymentCompletion = {
  booking: HotelBooking;
  payment: HotelBookingPayment;
};

@Injectable()
export class RoomBookingPaymentsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(HotelBookingPayment)
    private readonly paymentsRepository: Repository<HotelBookingPayment>,
    @InjectRepository(HotelBooking)
    private readonly bookingsRepository: Repository<HotelBooking>,
    @InjectRepository(HotelBookingPaymentWebhookEvent)
    private readonly webhookEventsRepository: Repository<HotelBookingPaymentWebhookEvent>,
    private readonly razorpayGateway: RazorpayDeliveryGatewayService,
  ) {}

  async findByUserAndIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<HotelBookingPayment | null> {
    return this.paymentsRepository.findOne({
      where: { userId, idempotencyKey },
      relations: { booking: true },
    });
  }

  async createPendingAttempt(
    manager: EntityManager,
    input: {
      booking: HotelBooking;
      user: User;
      idempotencyKey: string;
    },
  ): Promise<HotelBookingPayment> {
    const repository = manager.getRepository(HotelBookingPayment);
    const payment = repository.create({
      paymentReference: this.paymentReference(),
      bookingId: input.booking.id,
      userId: input.user.id,
      paymentMethod: HotelPaymentMethod.RAZORPAY,
      status: HotelPaymentStatus.PENDING,
      amountPaise: Number(numericToPaise(input.booking.totalAmount)),
      currency: input.booking.currency,
      gateway: 'RAZORPAY',
      gatewayOrderId: null,
      gatewayPaymentId: null,
      gatewaySignature: null,
      gatewayEventId: null,
      idempotencyKey: input.idempotencyKey,
      failureCode: null,
      failureReason: null,
      initiatedAt: new Date(),
      paidAt: null,
      failedAt: null,
    });
    const saved = await repository.save(payment);
    await this.log(
      {
        paymentId: saved.id,
        bookingId: input.booking.id,
        userId: input.user.id,
        eventType: 'ROOM_BOOKING_PAYMENT_ATTEMPT_CREATED',
        statusFrom: null,
        statusTo: HotelPaymentStatus.PENDING,
        gateway: 'RAZORPAY',
        gatewayOrderId: null,
        gatewayPaymentId: null,
        metadata: null,
      },
      manager,
    );
    return saved;
  }

  async createCheckoutForPayment(
    user: User,
    paymentId: string,
  ): Promise<RoomBookingPaymentResponseDto> {
    const existing = await this.requireCustomerPayment(paymentId, user.id);
    if (existing.status === HotelPaymentStatus.PAID) {
      return this.toResponse(existing);
    }
    if (existing.status === HotelPaymentStatus.FAILED) {
      return this.toResponse(existing);
    }
    if (existing.gatewayOrderId) {
      return this.toResponse(existing, true);
    }

    try {
      return await this.dataSource.transaction(async (manager) => {
        const payment = await this.lockPayment(paymentId, manager);
        if (!payment || payment.userId !== user.id) {
          throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
        }
        if (payment.status === HotelPaymentStatus.PAID) {
          return this.toResponse(payment);
        }
        if (payment.status === HotelPaymentStatus.FAILED) {
          return this.toResponse(payment);
        }
        if (payment.gatewayOrderId) {
          return this.toResponse(payment, true);
        }
        if (payment.status !== HotelPaymentStatus.PENDING) {
          throw new ConflictException('ROOM_BOOKING_PAYMENT_NOT_RETRYABLE');
        }

        const booking = await this.lockBooking(payment.bookingId, manager);
        if (!booking || booking.userId !== user.id) {
          throw new NotFoundException('ROOM_BOOKING_NOT_FOUND');
        }
        if (booking.bookingStatus !== HotelBookingStatus.PENDING) {
          throw new ConflictException('ROOM_BOOKING_NOT_PENDING_PAYMENT');
        }

        const gatewayOrder = await this.razorpayGateway.createRoomBookingOrder({
          amountPaise: payment.amountPaise,
          currency: payment.currency,
          receipt: payment.paymentReference,
          paymentReference: payment.paymentReference,
          bookingId: booking.id,
          userId: user.id,
        });
        if (
          gatewayOrder.amount !== payment.amountPaise ||
          gatewayOrder.currency !== payment.currency
        ) {
          throw new BadGatewayException('PAYMENT_GATEWAY_AMOUNT_MISMATCH');
        }

        payment.gatewayOrderId = gatewayOrder.id;
        const saved = await manager
          .getRepository(HotelBookingPayment)
          .save(payment);
        await this.log(
          {
            paymentId: saved.id,
            bookingId: saved.bookingId,
            userId: saved.userId,
            eventType: 'ROOM_BOOKING_RAZORPAY_ORDER_CREATED',
            statusFrom: HotelPaymentStatus.PENDING,
            statusTo: HotelPaymentStatus.PENDING,
            gateway: 'RAZORPAY',
            gatewayOrderId: saved.gatewayOrderId,
            gatewayPaymentId: null,
            metadata: { amount: saved.amountPaise, currency: saved.currency },
          },
          manager,
        );
        return this.toResponse(saved, true);
      });
    } catch (error) {
      await this.failPendingGatewayOrder(paymentId);
      throw error;
    }
  }

  async retry(
    user: User,
    bookingId: string,
    idempotencyKey: string,
  ): Promise<RoomBookingPaymentResponseDto> {
    const existing = await this.findByUserAndIdempotency(
      user.id,
      idempotencyKey,
    );
    if (existing) return this.createCheckoutForPayment(user, existing.id);

    let payment: HotelBookingPayment;
    try {
      payment = await this.dataSource.transaction(async (manager) => {
        const booking = await this.lockBooking(bookingId, manager);
        if (!booking || booking.userId !== user.id) {
          throw new NotFoundException('ROOM_BOOKING_NOT_FOUND');
        }
        if (booking.bookingStatus !== HotelBookingStatus.PENDING) {
          throw new ConflictException('ROOM_BOOKING_PAYMENT_NOT_RETRYABLE');
        }

        const latest = await manager
          .getRepository(HotelBookingPayment)
          .findOne({
            where: { bookingId, userId: user.id },
            order: { createdAt: 'DESC' },
          });
        if (!latest || latest.status !== HotelPaymentStatus.FAILED) {
          throw new ConflictException('ROOM_BOOKING_PAYMENT_NOT_RETRYABLE');
        }
        return this.createPendingAttempt(manager, {
          booking,
          user,
          idempotencyKey,
        });
      });
    } catch (error) {
      const concurrent = await this.findByUserAndIdempotency(
        user.id,
        idempotencyKey,
      );
      if (concurrent) return this.createCheckoutForPayment(user, concurrent.id);
      throw error;
    }
    return this.createCheckoutForPayment(user, payment.id);
  }

  async getForBooking(
    user: User,
    bookingId: string,
  ): Promise<RoomBookingPaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { bookingId, userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (!payment) throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
    return this.toResponse(payment);
  }

  async verify(
    user: User,
    bookingId: string,
    dto: VerifyRoomBookingPaymentDto,
  ): Promise<RoomBookingPaymentCompletion> {
    const payment = await this.paymentsRepository.findOne({
      where: {
        bookingId,
        userId: user.id,
        gatewayOrderId: dto.razorpayOrderId,
      },
    });
    if (!payment) throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
    if (payment.status === HotelPaymentStatus.PAID) {
      return this.loadCompletion(payment.id, user.id);
    }
    if (
      !this.razorpayGateway.verifyCheckoutSignature({
        orderId: dto.razorpayOrderId,
        paymentId: dto.razorpayPaymentId,
        signature: dto.razorpaySignature,
      })
    ) {
      throw new BadRequestException('INVALID_GATEWAY_SIGNATURE');
    }

    const gatewayPayment = await this.razorpayGateway.fetchPayment(
      dto.razorpayPaymentId,
    );
    if (
      gatewayPayment.order_id !== payment.gatewayOrderId ||
      gatewayPayment.amount !== payment.amountPaise ||
      gatewayPayment.currency !== payment.currency ||
      gatewayPayment.status !== 'captured' ||
      !gatewayPayment.captured
    ) {
      throw new ConflictException('PAYMENT_VERIFICATION_FAILED');
    }

    return this.completePayment(payment.id, {
      gatewayPaymentId: gatewayPayment.id,
      gatewaySignature: dto.razorpaySignature,
      gatewayEventId: null,
      eventType: 'ROOM_BOOKING_PAYMENT_VERIFIED',
    });
  }

  async recordFailure(
    user: User,
    bookingId: string,
    dto: RecordRoomBookingPaymentFailureDto,
  ): Promise<RoomBookingPaymentResponseDto> {
    const payment = await this.paymentsRepository.findOne({
      where: { bookingId, userId: user.id },
      order: { createdAt: 'DESC' },
    });
    if (!payment) throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
    const completed = await this.failPayment(payment.id, {
      code: dto.code ?? 'PAYMENT_FAILED',
      reason: dto.reason ?? 'Payment failed or was cancelled.',
      gatewayPaymentId: dto.razorpayPaymentId,
      gatewayEventId: null,
      eventType: 'ROOM_BOOKING_PAYMENT_FAILURE_RECORDED',
      expectedUserId: user.id,
    });
    return this.toResponse(completed.payment);
  }

  async handleRazorpayWebhook(input: {
    rawBody: string;
    signature: string;
    eventId: string | undefined;
    payload: RazorpayRoomBookingWebhookPayload;
  }): Promise<void> {
    if (
      !this.razorpayGateway.verifyWebhookSignature(
        input.rawBody,
        input.signature,
      )
    ) {
      throw new ForbiddenException('WEBHOOK_SIGNATURE_INVALID');
    }
    const webhookEventId =
      input.eventId ??
      `body:${createHash('sha256').update(input.rawBody).digest('hex')}`;
    if (
      await this.webhookEventsRepository.findOne({
        where: { eventId: webhookEventId },
      })
    ) {
      return;
    }

    const entity = input.payload.payload?.payment?.entity;
    const webhook = await this.createWebhookEvent(
      { ...input, eventId: webhookEventId },
      entity,
    );
    if (!webhook) return;
    if (!entity?.order_id || !entity.id) {
      await this.markWebhookIgnored(webhook.id, 'PAYMENT_ENTITY_MISSING');
      return;
    }

    const payment = await this.paymentsRepository.findOne({
      where: { gatewayOrderId: entity.order_id },
    });
    if (!payment) {
      await this.markWebhookIgnored(
        webhook.id,
        'ROOM_BOOKING_PAYMENT_NOT_FOUND',
      );
      return;
    }

    const eventType = input.payload.event ?? 'unknown';
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
        gatewaySignature: null,
        gatewayEventId: webhookEventId,
        eventType: 'ROOM_BOOKING_PAYMENT_WEBHOOK_CAPTURED',
      });
      await this.markWebhookProcessed(webhook.id, payment.id);
      return;
    }

    if (eventType === 'payment.failed') {
      await this.failPayment(payment.id, {
        code: entity.error_code ?? 'PAYMENT_FAILED',
        reason: entity.error_description ?? 'Payment failed at the gateway.',
        gatewayPaymentId: entity.id,
        gatewayEventId: webhookEventId,
        eventType: 'ROOM_BOOKING_PAYMENT_WEBHOOK_FAILED',
      });
      await this.markWebhookProcessed(webhook.id, payment.id);
      return;
    }
    await this.markWebhookIgnored(webhook.id, 'EVENT_NOT_HANDLED');
  }

  toResponse(
    payment: HotelBookingPayment,
    includeCheckoutKey = false,
  ): RoomBookingPaymentResponseDto {
    const response: RoomBookingPaymentResponseDto = {
      id: payment.id,
      bookingId: payment.bookingId,
      paymentReference: payment.paymentReference,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      gateway: payment.gateway,
      amount: payment.amountPaise,
      currency: payment.currency,
      razorpayOrderId: payment.gatewayOrderId,
      razorpayPaymentId: payment.gatewayPaymentId,
      failureCode: payment.failureCode,
      failureReason: payment.failureReason,
      initiatedAt: payment.initiatedAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      failedAt: payment.failedAt?.toISOString() ?? null,
    };
    if (includeCheckoutKey && payment.gatewayOrderId) {
      response.keyId = this.razorpayGateway.getPublicKey();
    }
    return response;
  }

  toBookingResponse(booking: HotelBooking): HotelBookingResponseDto {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      bookingStatus: booking.bookingStatus,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      checkInDate: booking.checkInDate,
      checkOutDate: booking.checkOutDate,
      numberOfNights: booking.numberOfNights,
      roomCount: booking.roomCount,
      adultCount: booking.adultCount,
      childCount: booking.childCount,
      subtotal: Number(booking.subtotal),
      taxAmount: Number(booking.taxAmount),
      discountAmount: Number(booking.discountAmount),
      totalAmount: Number(booking.totalAmount),
      currency: booking.currency,
      nightlyBreakdown: booking.nightlyPriceBreakdown.map((night) => ({
        date: night.date,
        roomCount: night.roomCount,
        pricePerRoom: Number(night.pricePerRoom),
        lineTotal: Number(night.lineTotal),
      })),
      hotel: booking.hotel
        ? {
            id: booking.hotel.id,
            name: booking.hotel.name,
            city: booking.hotel.city,
            state: booking.hotel.state,
            country: booking.hotel.country,
            primaryImage: primaryImageUrl(booking.hotel.images),
          }
        : { id: booking.hotelId },
      room: booking.room
        ? {
            id: booking.room.id,
            name: booking.room.name,
            roomType: booking.room.roomType,
            bedType: booking.room.bedType,
            primaryImage: primaryImageUrl(booking.room.images),
          }
        : { id: booking.roomId },
      guests: (booking.guests ?? []).map((guest) => ({
        id: guest.id,
        fullName: guest.fullName,
        age: guest.age,
        isPrimaryGuest: guest.isPrimaryGuest,
      })),
      cancellationReason: booking.cancellationReason,
      confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private async completePayment(
    paymentId: string,
    input: {
      gatewayPaymentId: string;
      gatewaySignature: string | null;
      gatewayEventId: string | null;
      eventType: string;
    },
  ): Promise<RoomBookingPaymentCompletion> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await this.lockPayment(paymentId, manager);
      if (!payment)
        throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
      const booking = await this.lockBooking(payment.bookingId, manager);
      if (!booking) throw new NotFoundException('ROOM_BOOKING_NOT_FOUND');
      if (payment.status === HotelPaymentStatus.PAID) {
        return { payment, booking };
      }
      if (booking.bookingStatus !== HotelBookingStatus.PENDING) {
        throw new ConflictException('ROOM_BOOKING_NOT_PENDING_PAYMENT');
      }

      const successfulPayment = await manager
        .getRepository(HotelBookingPayment)
        .findOne({
          where: { bookingId: booking.id, status: HotelPaymentStatus.PAID },
        });
      if (successfulPayment && successfulPayment.id !== payment.id) {
        throw new ConflictException('ROOM_BOOKING_ALREADY_PAID');
      }

      const now = new Date();
      const previousStatus = payment.status;
      payment.status = HotelPaymentStatus.PAID;
      payment.gatewayPaymentId = input.gatewayPaymentId;
      payment.gatewaySignature = input.gatewaySignature;
      payment.gatewayEventId = input.gatewayEventId;
      payment.failureCode = null;
      payment.failureReason = null;
      payment.failedAt = null;
      payment.paidAt = now;
      const savedPayment = await manager
        .getRepository(HotelBookingPayment)
        .save(payment);

      booking.paymentStatus = HotelPaymentStatus.PAID;
      booking.bookingStatus = HotelBookingStatus.CONFIRMED;
      booking.confirmedAt = now;
      const savedBooking = await manager
        .getRepository(HotelBooking)
        .save(booking);
      await manager.getRepository(BookingStatusHistory).save(
        manager.getRepository(BookingStatusHistory).create({
          bookingId: savedBooking.id,
          status: HotelBookingStatus.CONFIRMED,
          changedByUserId: savedBooking.userId,
          reason: 'RAZORPAY_PAYMENT_CONFIRMED',
        }),
      );
      await this.log(
        {
          paymentId: savedPayment.id,
          bookingId: savedBooking.id,
          userId: savedPayment.userId,
          eventType: input.eventType,
          statusFrom: previousStatus,
          statusTo: HotelPaymentStatus.PAID,
          gateway: savedPayment.gateway,
          gatewayOrderId: savedPayment.gatewayOrderId,
          gatewayPaymentId: savedPayment.gatewayPaymentId,
          metadata: null,
        },
        manager,
      );
      return { payment: savedPayment, booking: savedBooking };
    });
  }

  private async failPayment(
    paymentId: string,
    input: {
      code: string;
      reason: string;
      gatewayPaymentId?: string;
      gatewayEventId: string | null;
      eventType: string;
      expectedUserId?: string;
    },
  ): Promise<RoomBookingPaymentCompletion> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await this.lockPayment(paymentId, manager);
      if (!payment)
        throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
      const booking = await this.lockBooking(payment.bookingId, manager);
      if (!booking) throw new NotFoundException('ROOM_BOOKING_NOT_FOUND');
      if (input.expectedUserId && payment.userId !== input.expectedUserId) {
        throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
      }
      if (payment.status === HotelPaymentStatus.PAID)
        return { payment, booking };
      if (payment.status === HotelPaymentStatus.FAILED)
        return { payment, booking };

      const previousStatus = payment.status;
      payment.status = HotelPaymentStatus.FAILED;
      payment.failureCode = input.code.slice(0, 120);
      payment.failureReason = input.reason.slice(0, 500);
      payment.gatewayPaymentId =
        input.gatewayPaymentId ?? payment.gatewayPaymentId;
      payment.gatewayEventId = input.gatewayEventId;
      payment.failedAt = new Date();
      const saved = await manager
        .getRepository(HotelBookingPayment)
        .save(payment);
      await this.log(
        {
          paymentId: saved.id,
          bookingId: saved.bookingId,
          userId: saved.userId,
          eventType: input.eventType,
          statusFrom: previousStatus,
          statusTo: HotelPaymentStatus.FAILED,
          gateway: saved.gateway,
          gatewayOrderId: saved.gatewayOrderId,
          gatewayPaymentId: saved.gatewayPaymentId,
          metadata: { code: saved.failureCode },
        },
        manager,
      );
      return { payment: saved, booking };
    });
  }

  private async failPendingGatewayOrder(paymentId: string): Promise<void> {
    try {
      await this.failPayment(paymentId, {
        code: 'PAYMENT_ORDER_CREATION_FAILED',
        reason: 'Unable to create a Razorpay payment order. Please retry.',
        gatewayEventId: null,
        eventType: 'ROOM_BOOKING_RAZORPAY_ORDER_CREATION_FAILED',
      });
    } catch {
      // The original checkout error remains the correct API response.
    }
  }

  private async loadCompletion(
    paymentId: string,
    userId: string,
  ): Promise<RoomBookingPaymentCompletion> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
    const booking = await this.bookingsRepository.findOne({
      where: { id: payment.bookingId, userId },
    });
    if (!booking) throw new NotFoundException('ROOM_BOOKING_NOT_FOUND');
    return { payment, booking };
  }

  private async requireCustomerPayment(
    paymentId: string,
    userId: string,
  ): Promise<HotelBookingPayment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('ROOM_BOOKING_PAYMENT_NOT_FOUND');
    return payment;
  }

  private async lockPayment(
    paymentId: string,
    manager: EntityManager,
  ): Promise<HotelBookingPayment | null> {
    return manager
      .getRepository(HotelBookingPayment)
      .createQueryBuilder('payment')
      .where('payment.id = :paymentId', { paymentId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async lockBooking(
    bookingId: string,
    manager: EntityManager,
  ): Promise<HotelBooking | null> {
    return manager
      .getRepository(HotelBooking)
      .createQueryBuilder('booking')
      .where('booking.id = :bookingId', { bookingId })
      .setLock('pessimistic_write')
      .getOne();
  }

  private async createWebhookEvent(
    input: {
      eventId: string;
      payload: RazorpayRoomBookingWebhookPayload;
    },
    entity: RazorpayRoomBookingPaymentEntity | undefined,
  ): Promise<HotelBookingPaymentWebhookEvent | null> {
    try {
      return await this.webhookEventsRepository.save(
        this.webhookEventsRepository.create({
          gateway: 'RAZORPAY',
          eventId: input.eventId ?? null,
          eventType: input.payload.event ?? 'unknown',
          gatewayOrderId: entity?.order_id ?? null,
          gatewayPaymentId: entity?.id ?? null,
          paymentId: null,
          processed: false,
          ignoredReason: null,
          payload: input.payload,
        }),
      );
    } catch (error) {
      if (this.isUniqueViolation(error)) return null;
      throw error;
    }
  }

  private async markWebhookProcessed(
    webhookId: string,
    paymentId: string,
  ): Promise<void> {
    await this.webhookEventsRepository.update(webhookId, {
      paymentId,
      processed: true,
      ignoredReason: null,
    });
  }

  private async markWebhookIgnored(
    webhookId: string,
    reason: string,
  ): Promise<void> {
    await this.webhookEventsRepository.update(webhookId, {
      processed: false,
      ignoredReason: reason,
    });
  }

  private async log(
    data: Omit<HotelBookingPaymentTransactionLog, 'id' | 'createdAt'>,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(HotelBookingPaymentTransactionLog)
      .save(
        manager.getRepository(HotelBookingPaymentTransactionLog).create(data),
      );
  }

  private paymentReference(): string {
    return `HBP-${randomUUID().replace(/-/g, '').slice(0, 18).toUpperCase()}`;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    );
  }
}

function primaryImageUrl(
  images:
    | Array<{ imageUrl: string; isPrimary: boolean; sortOrder: number }>
    | undefined,
): string | null {
  if (!images?.length) return null;
  const ordered = images
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
  return (
    ordered.find((image) => image.isPrimary)?.imageUrl ??
    ordered[0]?.imageUrl ??
    null
  );
}
