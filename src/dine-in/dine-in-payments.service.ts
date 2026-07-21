import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { DineInPaymentListQueryDto } from './dto/dine-in-payment-list-query.dto';
import {
  DineInPaymentResponseDto,
  PaginatedDineInPaymentsResponseDto,
} from './dto/dine-in-payment-response.dto';
import { InitiateDineInPaymentDto } from './dto/initiate-dine-in-payment.dto';
import { RejectDineInCashPaymentDto } from './dto/reject-dine-in-cash-payment.dto';
import { VerifyDineInPaymentDto } from './dto/verify-dine-in-payment.dto';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInPayment } from './entities/dine-in-payment.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { PaymentMethod, PaymentStatus } from './enums/order.enums';
import { DineInPaymentsRepository } from './dine-in-payments.repository';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { RazorpayGatewayService } from './razorpay-gateway.service';

export type RazorpayWebhookPayload = {
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

@Injectable()
export class DineInPaymentsService {
  constructor(
    private readonly paymentsRepository: DineInPaymentsRepository,
    private readonly membersRepository: DineInSessionMembersRepository,
    private readonly restaurantsService: RestaurantsService,
    private readonly razorpayGateway: RazorpayGatewayService,
  ) {}

  async initiate(
    user: User,
    invoiceId: string,
    dto: InitiateDineInPaymentDto,
    idempotencyKey: string,
  ): Promise<DineInPaymentResponseDto> {
    this.ensureCustomer(user);
    const attempt = await this.createAttempt(
      user,
      invoiceId,
      dto.method,
      idempotencyKey,
    );
    if (attempt.reused || dto.method === PaymentMethod.CASH)
      return this.toResponse(attempt.payment, attempt.invoice);

    try {
      const gatewayOrder = await this.razorpayGateway.createOrder({
        amountPaise: attempt.payment.amountPaise,
        currency: attempt.payment.currency,
        receipt: attempt.payment.paymentReference ?? attempt.payment.id,
        paymentReference:
          attempt.payment.paymentReference ?? attempt.payment.id,
      });
      if (
        gatewayOrder.amount !== attempt.payment.amountPaise ||
        gatewayOrder.currency !== attempt.payment.currency
      ) {
        await this.failGatewayCreation(attempt.payment.id);
        throw new BadGatewayException('PAYMENT_AMOUNT_MISMATCH');
      }
      const saved = await this.paymentsRepository.transaction(
        async (manager) => {
          const payment = await this.requireLockedPayment(
            attempt.payment.id,
            manager,
          );
          if (payment.status !== PaymentStatus.PROCESSING) return payment;
          payment.gatewayOrderId = gatewayOrder.id;
          payment.status = PaymentStatus.PENDING;
          return this.paymentsRepository.save(payment, manager);
        },
      );
      return this.toResponse(saved, attempt.invoice);
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      await this.failGatewayCreation(attempt.payment.id);
      throw new BadGatewayException('PAYMENT_GATEWAY_ORDER_CREATION_FAILED');
    }
  }

  async getForInvoice(
    user: User,
    invoiceId: string,
  ): Promise<DineInPaymentResponseDto> {
    this.ensureCustomer(user);
    const invoice = await this.requireInvoice(invoiceId);
    await this.requireMember(invoice.dineInSessionId, user.id);
    const payment = await this.paymentsRepository.findLatestForInvoice(
      invoice.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.toResponse(payment, invoice);
  }

  async getForCustomer(
    user: User,
    paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    this.ensureCustomer(user);
    const payment = await this.paymentsRepository.findForCustomer(
      paymentId,
      user.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.toResponse(
      payment,
      await this.requireInvoiceForPayment(payment),
    );
  }

  async listForCustomer(
    user: User,
    query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    this.ensureCustomer(user);
    const result = await this.paymentsRepository.listForCustomer(
      user.id,
      query,
    );
    return this.paginate(result, query);
  }

  async verify(
    user: User,
    paymentId: string,
    dto: VerifyDineInPaymentDto,
  ): Promise<DineInPaymentResponseDto> {
    this.ensureCustomer(user);
    const payment = await this.paymentsRepository.findForCustomer(
      paymentId,
      user.id,
    );
    if (!payment) throw new NotFoundException('PAYMENT_NOT_FOUND');
    const invoice = await this.requireInvoiceForPayment(payment);
    if (payment.status === PaymentStatus.SUCCESS)
      return this.toResponse(payment, invoice);
    if (![PaymentMethod.UPI, PaymentMethod.CARD].includes(payment.method))
      throw new ConflictException('PAYMENT_METHOD_NOT_SUPPORTED');
    if (payment.status !== PaymentStatus.PENDING)
      throw new ConflictException('PAYMENT_ALREADY_PROCESSING');
    if (
      !payment.gatewayOrderId ||
      dto.gatewayOrderId !== payment.gatewayOrderId
    )
      throw new BadRequestException('PAYMENT_VERIFICATION_FAILED');
    if (
      !this.razorpayGateway.verifyCheckoutSignature({
        orderId: payment.gatewayOrderId,
        paymentId: dto.gatewayPaymentId,
        signature: dto.gatewaySignature,
      })
    )
      throw new BadRequestException('INVALID_GATEWAY_SIGNATURE');

    const gatewayPayment = await this.razorpayGateway.fetchPayment(
      dto.gatewayPaymentId,
    );
    if (
      gatewayPayment.order_id !== payment.gatewayOrderId ||
      gatewayPayment.amount !== payment.amountPaise ||
      gatewayPayment.currency !== payment.currency ||
      !gatewayPayment.captured ||
      gatewayPayment.status !== 'captured'
    )
      throw new ConflictException('PAYMENT_VERIFICATION_FAILED');

    return this.completeVerifiedPayment(payment.id, {
      gatewayPaymentId: gatewayPayment.id,
      gatewaySignature: dto.gatewaySignature,
      transactionReference: gatewayPayment.id,
    });
  }

  async confirmCash(
    user: User,
    restaurantId: string,
    paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const payment = await this.requirePayment(paymentId);
    this.requirePaymentRestaurant(payment, restaurantId);
    if (payment.method !== PaymentMethod.CASH)
      throw new ConflictException('CASH_CONFIRMATION_NOT_ALLOWED');
    if (payment.status === PaymentStatus.SUCCESS)
      return this.toResponse(
        payment,
        await this.requireInvoiceForPayment(payment),
      );
    if (payment.status !== PaymentStatus.AWAITING_CASH_CONFIRMATION)
      throw new ConflictException('CASH_CONFIRMATION_NOT_ALLOWED');
    return this.completeVerifiedPayment(payment.id, {
      cashConfirmedByUserId: user.id,
      transactionReference: `CASH-${payment.paymentReference ?? payment.id}`,
    });
  }

  async rejectCash(
    user: User,
    restaurantId: string,
    paymentId: string,
    dto: RejectDineInCashPaymentDto,
  ): Promise<DineInPaymentResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const result = await this.paymentsRepository.transaction(
      async (manager) => {
        const payment = await this.requireLockedPayment(paymentId, manager);
        this.requirePaymentRestaurant(payment, restaurantId);
        if (
          payment.method !== PaymentMethod.CASH ||
          payment.status !== PaymentStatus.AWAITING_CASH_CONFIRMATION
        )
          throw new ConflictException('CASH_CONFIRMATION_NOT_ALLOWED');
        const invoice = await this.requireLockedInvoiceForPayment(
          payment,
          manager,
        );
        const session = await this.requireLockedSession(
          invoice.dineInSessionId,
          manager,
        );
        this.ensureInvoiceSessionPair(invoice, session, payment);
        payment.status = PaymentStatus.FAILED;
        payment.failureCode = 'CASH_REJECTED';
        payment.failureReason = dto.reason;
        payment.failedAt = new Date();
        return {
          payment: await this.paymentsRepository.save(payment, manager),
          invoice,
        };
      },
    );
    return this.toResponse(result.payment, result.invoice);
  }

  async listForManager(
    user: User,
    restaurantId: string,
    query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.paginate(
      await this.paymentsRepository.listForRestaurant(restaurantId, query),
      query,
    );
  }

  async listCashPendingForManager(
    user: User,
    restaurantId: string,
    query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.paginate(
      await this.paymentsRepository.listForRestaurant(
        restaurantId,
        query,
        true,
      ),
      query,
    );
  }

  async getForManager(
    user: User,
    restaurantId: string,
    paymentId: string,
  ): Promise<DineInPaymentResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const payment = await this.requirePayment(paymentId);
    this.requirePaymentRestaurant(payment, restaurantId);
    return this.toResponse(
      payment,
      await this.requireInvoiceForPayment(payment),
    );
  }

  async handleRazorpayWebhook(input: {
    rawBody: string;
    signature: string;
    eventId: string | undefined;
    payload: RazorpayWebhookPayload;
  }): Promise<void> {
    if (
      !this.razorpayGateway.verifyWebhookSignature(
        input.rawBody,
        input.signature,
      )
    )
      throw new ForbiddenException('WEBHOOK_SIGNATURE_INVALID');
    if (
      input.eventId &&
      (await this.paymentsRepository.findByGatewayEventId(input.eventId))
    )
      return;
    const entity = input.payload.payload?.payment?.entity;
    if (!entity?.order_id || !entity.id) return;
    const payment = await this.paymentsRepository.findByGatewayOrderId(
      entity.order_id,
    );
    if (!payment || !payment.invoiceId) return;
    if (
      input.payload.event === 'payment.captured' ||
      input.payload.event === 'order.paid'
    ) {
      if (
        entity.amount !== payment.amountPaise ||
        entity.currency !== payment.currency ||
        entity.status !== 'captured' ||
        !entity.captured
      )
        return;
      await this.completeVerifiedPayment(payment.id, {
        gatewayPaymentId: entity.id,
        gatewayEventId: input.eventId,
        transactionReference: entity.id,
      });
      return;
    }
    if (input.payload.event === 'payment.failed')
      await this.recordGatewayFailure(
        payment.id,
        entity.error_code ?? 'PAYMENT_FAILED',
        entity.error_description ?? 'Payment failed at the gateway.',
      );
  }

  private async createAttempt(
    user: User,
    invoiceId: string,
    method: InitiateDineInPaymentDto['method'],
    idempotencyKey: string,
  ): Promise<{
    payment: DineInPayment;
    invoice: DineInInvoice;
    reused: boolean;
  }> {
    return this.paymentsRepository.transaction(async (manager) => {
      const invoice = await this.requireLockedInvoice(invoiceId, manager);
      const session = await this.requireLockedSession(
        invoice.dineInSessionId,
        manager,
      );
      await this.requireMember(session.id, user.id, manager);
      this.ensurePaymentEligibility(invoice, session);
      const sameRequest =
        await this.paymentsRepository.findByInvoiceAndIdempotency(
          invoice.id,
          idempotencyKey,
          manager,
        );
      if (sameRequest) return { payment: sameRequest, invoice, reused: true };
      if (
        await this.paymentsRepository.findSuccessfulForInvoice(
          invoice.id,
          manager,
        )
      )
        throw new ConflictException('INVOICE_ALREADY_PAID');
      if (await this.paymentsRepository.findOpenForInvoice(invoice.id, manager))
        throw new ConflictException('DUPLICATE_PAYMENT_ATTEMPT');
      const now = new Date();
      const payment = this.paymentsRepository.create(
        {
          paymentReference: this.paymentReference(),
          invoiceId: invoice.id,
          dineInSessionId: session.id,
          orderId: null,
          userId: user.id,
          restaurantId: invoice.restaurantId,
          amountPaise: invoice.totalPaise,
          currency: invoice.currency,
          method,
          status:
            method === PaymentMethod.CASH
              ? PaymentStatus.AWAITING_CASH_CONFIRMATION
              : PaymentStatus.PROCESSING,
          gateway: method === PaymentMethod.CASH ? null : 'RAZORPAY',
          gatewayOrderId: null,
          gatewayPaymentId: null,
          gatewaySignature: null,
          gatewayEventId: null,
          transactionReference: null,
          idempotencyKey,
          failureCode: null,
          failureReason: null,
          cashConfirmedByUserId: null,
          initiatedAt: now,
          completedAt: null,
          failedAt: null,
          paidAt: null,
          refundedAt: null,
        },
        manager,
      );
      return {
        payment: await this.paymentsRepository.save(payment, manager),
        invoice,
        reused: false,
      };
    });
  }

  private async completeVerifiedPayment(
    paymentId: string,
    updates: {
      gatewayPaymentId?: string;
      gatewaySignature?: string;
      gatewayEventId?: string;
      transactionReference: string;
      cashConfirmedByUserId?: string;
    },
  ): Promise<DineInPaymentResponseDto> {
    const result = await this.paymentsRepository.transaction(
      async (manager) => {
        const payment = await this.requireLockedPayment(paymentId, manager);
        const invoice = await this.requireLockedInvoiceForPayment(
          payment,
          manager,
        );
        const session = await this.requireLockedSession(
          invoice.dineInSessionId,
          manager,
        );
        this.ensureInvoiceSessionPair(invoice, session, payment);
        if (payment.status === PaymentStatus.SUCCESS)
          return { payment, invoice };
        if (
          await this.paymentsRepository.findSuccessfulForInvoice(
            invoice.id,
            manager,
          )
        )
          throw new ConflictException('PAYMENT_ALREADY_SUCCESSFUL');
        this.ensurePaymentEligibility(invoice, session);
        const now = new Date();
        payment.status = PaymentStatus.SUCCESS;
        payment.gatewayPaymentId =
          updates.gatewayPaymentId ?? payment.gatewayPaymentId;
        payment.gatewaySignature =
          updates.gatewaySignature ?? payment.gatewaySignature;
        payment.gatewayEventId =
          updates.gatewayEventId ?? payment.gatewayEventId;
        payment.transactionReference = updates.transactionReference;
        payment.cashConfirmedByUserId =
          updates.cashConfirmedByUserId ?? payment.cashConfirmedByUserId;
        payment.completedAt = now;
        payment.paidAt = now;
        payment.failedAt = null;
        payment.failureCode = null;
        payment.failureReason = null;
        invoice.status = DineInInvoiceStatus.PAID;
        invoice.paidAt = now;
        session.status = DineInSessionStatus.COMPLETED;
        session.paymentCompletedAt = now;
        session.completedAt = now;
        session.closedAt = now;
        return {
          payment: await this.paymentsRepository.save(payment, manager),
          invoice: await this.paymentsRepository.saveInvoice(invoice, manager),
          session: await this.paymentsRepository.saveSession(session, manager),
        };
      },
    );
    return this.toResponse(result.payment, result.invoice);
  }

  private async failGatewayCreation(paymentId: string): Promise<void> {
    await this.recordGatewayFailure(
      paymentId,
      'GATEWAY_ORDER_CREATION_FAILED',
      'Unable to create the payment gateway order.',
    );
  }

  private async recordGatewayFailure(
    paymentId: string,
    code: string,
    reason: string,
  ): Promise<void> {
    await this.paymentsRepository.transaction(async (manager) => {
      const payment = await this.requireLockedPayment(paymentId, manager);
      if (payment.status === PaymentStatus.SUCCESS) return;
      payment.status = PaymentStatus.FAILED;
      payment.failureCode = code;
      payment.failureReason = reason;
      payment.failedAt = new Date();
      await this.paymentsRepository.save(payment, manager);
    });
  }

  private async paginate(
    result: { items: DineInPayment[]; total: number },
    query: DineInPaymentListQueryDto,
  ): Promise<PaginatedDineInPaymentsResponseDto> {
    return {
      items: await Promise.all(
        result.items.map(async (payment) =>
          this.toResponse(
            payment,
            await this.requireInvoiceForPayment(payment),
          ),
        ),
      ),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  private toResponse(
    payment: DineInPayment,
    invoice: DineInInvoice,
  ): DineInPaymentResponseDto {
    const online =
      (payment.method === PaymentMethod.UPI ||
        payment.method === PaymentMethod.CARD) &&
      payment.gateway === 'RAZORPAY' &&
      payment.gatewayOrderId &&
      payment.status === PaymentStatus.PENDING;
    return {
      id: payment.id,
      paymentReference: payment.paymentReference ?? payment.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      sessionId: invoice.dineInSessionId,
      method: payment.method,
      status: payment.status,
      amountPaise: payment.amountPaise,
      currency: payment.currency,
      transactionReference: payment.transactionReference,
      failure:
        payment.failureCode || payment.failureReason
          ? { code: payment.failureCode, reason: payment.failureReason }
          : null,
      initiatedAt: (payment.initiatedAt ?? payment.createdAt).toISOString(),
      completedAt: payment.completedAt?.toISOString() ?? null,
      ...(online
        ? {
            checkout: {
              gateway: 'RAZORPAY' as const,
              keyId: this.razorpayGateway.getPublicKey(),
              orderId: payment.gatewayOrderId!,
              amountPaise: payment.amountPaise,
              currency: payment.currency,
            },
          }
        : {}),
    };
  }

  private ensurePaymentEligibility(
    invoice: DineInInvoice,
    session: DineInSession,
  ): void {
    if (invoice.status === DineInInvoiceStatus.PAID)
      throw new ConflictException('INVOICE_ALREADY_PAID');
    if (invoice.status !== DineInInvoiceStatus.PAYMENT_PENDING)
      throw new ConflictException('INVOICE_NOT_PAYMENT_PENDING');
    if (session.status === DineInSessionStatus.COMPLETED)
      throw new ConflictException('SESSION_COMPLETED');
    if (session.status === DineInSessionStatus.CANCELLED)
      throw new ConflictException('SESSION_CANCELLED');
    if (session.status !== DineInSessionStatus.PAYMENT_PENDING)
      throw new ConflictException('SESSION_NOT_PAYMENT_PENDING');
    if (invoice.totalPaise <= 0)
      throw new BadRequestException('PAYMENT_AMOUNT_MISMATCH');
  }

  private async requireInvoice(id: string): Promise<DineInInvoice> {
    const invoice = await this.paymentsRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return invoice;
  }

  private async requireInvoiceForPayment(
    payment: DineInPayment,
  ): Promise<DineInInvoice> {
    if (!payment.invoiceId) throw new NotFoundException('PAYMENT_NOT_FOUND');
    return this.requireInvoice(payment.invoiceId);
  }

  private async requirePayment(id: string): Promise<DineInPayment> {
    const payment = await this.paymentsRepository.findById(id);
    if (!payment || !payment.invoiceId)
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    return payment;
  }

  private async requireLockedPayment(
    id: string,
    manager: EntityManager,
  ): Promise<DineInPayment> {
    const payment = await this.paymentsRepository.lockPayment(id, manager);
    if (!payment || !payment.invoiceId)
      throw new NotFoundException('PAYMENT_NOT_FOUND');
    return payment;
  }

  private async requireLockedInvoice(
    id: string,
    manager: EntityManager,
  ): Promise<DineInInvoice> {
    const invoice = await this.paymentsRepository.lockInvoice(id, manager);
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return invoice;
  }

  private async requireLockedInvoiceForPayment(
    payment: DineInPayment,
    manager: EntityManager,
  ): Promise<DineInInvoice> {
    return this.requireLockedInvoice(payment.invoiceId ?? '', manager);
  }

  private async requireLockedSession(
    id: string,
    manager: EntityManager,
  ): Promise<DineInSession> {
    const session = await this.paymentsRepository.lockSession(id, manager);
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    return session;
  }

  private async requireMember(
    sessionId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (
      !(await this.membersRepository.findMembership(sessionId, userId, manager))
    )
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive || user.role !== UserRole.CUSTOMER)
      throw new ForbiddenException(
        'Only active customers can manage payments.',
      );
  }

  private async requireManagedRestaurant(
    user: User,
    restaurantId: string,
  ): Promise<void> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    if (
      !user.isActive ||
      (user.role !== UserRole.RESTAURANT_OWNER &&
        user.role !== UserRole.ADMIN) ||
      (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id)
    )
      throw new ForbiddenException('RESTAURANT_ACCESS_DENIED');
  }

  private requirePaymentRestaurant(
    payment: DineInPayment,
    restaurantId: string,
  ): void {
    if (payment.restaurantId !== restaurantId)
      throw new NotFoundException('PAYMENT_NOT_FOUND');
  }

  private ensureInvoiceSessionPair(
    invoice: DineInInvoice,
    session: DineInSession,
    payment: DineInPayment,
  ): void {
    if (
      payment.invoiceId !== invoice.id ||
      payment.dineInSessionId !== session.id ||
      invoice.dineInSessionId !== session.id ||
      payment.restaurantId !== invoice.restaurantId ||
      session.restaurantId !== invoice.restaurantId
    )
      throw new ConflictException('PAYMENT_VERIFICATION_FAILED');
  }

  private paymentReference(): string {
    return `DIN-PAY-${randomUUID().replace(/-/g, '').slice(0, 32).toUpperCase()}`;
  }
}
