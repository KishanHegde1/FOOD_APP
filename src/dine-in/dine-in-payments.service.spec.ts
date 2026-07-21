import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DineInPaymentsRepository } from './dine-in-payments.repository';
import { DineInPaymentsService } from './dine-in-payments.service';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInPayment } from './entities/dine-in-payment.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { PaymentMethod, PaymentStatus } from './enums/order.enums';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';

const CUSTOMER_ID = '10000000-0000-4000-8000-000000000001';
const OWNER_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_OWNER_ID = '30000000-0000-4000-8000-000000000001';
const RESTAURANT_ID = '40000000-0000-4000-8000-000000000001';
const SESSION_ID = '50000000-0000-4000-8000-000000000001';
const INVOICE_ID = '60000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '70000000-0000-4000-8000-000000000001';

describe('DineInPaymentsService', () => {
  let service: DineInPaymentsService;
  let repository: Record<string, jest.Mock>;
  let gateway: Record<string, jest.Mock>;
  let restaurants: Record<string, jest.Mock>;

  beforeEach(() => {
    repository = {
      transaction: jest.fn(
        (operation: (manager: Record<string, never>) => Promise<unknown>) =>
          operation({}),
      ),
      lockInvoice: jest.fn().mockResolvedValue(invoice()),
      lockSession: jest.fn().mockResolvedValue(session()),
      lockPayment: jest.fn().mockResolvedValue(payment()),
      findInvoiceById: jest.fn().mockResolvedValue(invoice()),
      findById: jest.fn().mockResolvedValue(payment()),
      findForCustomer: jest.fn().mockResolvedValue(payment()),
      findLatestForInvoice: jest.fn().mockResolvedValue(payment()),
      findByInvoiceAndIdempotency: jest.fn().mockResolvedValue(null),
      findOpenForInvoice: jest.fn().mockResolvedValue(null),
      findSuccessfulForInvoice: jest.fn().mockResolvedValue(null),
      findByGatewayEventId: jest.fn().mockResolvedValue(null),
      findByGatewayOrderId: jest.fn().mockResolvedValue(payment()),
      create: jest.fn((data: Partial<DineInPayment>) => payment(data)),
      save: jest.fn((entity: DineInPayment) => Promise.resolve(entity)),
      saveInvoice: jest.fn((entity: DineInInvoice) => Promise.resolve(entity)),
      saveSession: jest.fn((entity: DineInSession) => Promise.resolve(entity)),
      listForCustomer: jest.fn(),
      listForRestaurant: jest.fn(),
    };
    gateway = {
      getPublicKey: jest.fn().mockReturnValue('rzp_test_public'),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_test',
        amount: 70250,
        currency: 'INR',
      }),
      verifyCheckoutSignature: jest.fn().mockReturnValue(true),
      fetchPayment: jest.fn().mockResolvedValue({
        id: 'pay_test',
        order_id: 'order_test',
        amount: 70250,
        currency: 'INR',
        status: 'captured',
        captured: true,
      }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };
    restaurants = {
      findOneForManagement: jest.fn().mockResolvedValue({
        id: RESTAURANT_ID,
        ownerId: OWNER_ID,
      }),
    };
    service = new DineInPaymentsService(
      repository as unknown as DineInPaymentsRepository,
      {
        findMembership: jest.fn().mockResolvedValue({ id: 'member' }),
      } as unknown as DineInSessionMembersRepository,
      restaurants as unknown as RestaurantsService,
      gateway as unknown as RazorpayGatewayService,
    );
  });

  it('uses the invoice amount for a cash request and leaves the invoice payable', async () => {
    const result = await service.initiate(
      customer(),
      INVOICE_ID,
      { method: PaymentMethod.CASH },
      'cash-request-1',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 70250,
        currency: 'INR',
        method: PaymentMethod.CASH,
        status: PaymentStatus.AWAITING_CASH_CONFIRMATION,
      }),
      expect.anything(),
    );
    expect(repository.saveInvoice).not.toHaveBeenCalled();
    expect(result.status).toBe(PaymentStatus.AWAITING_CASH_CONFIRMATION);
  });

  it('returns the existing payment for a duplicate idempotency key', async () => {
    const existing = payment({
      method: PaymentMethod.CASH,
      status: PaymentStatus.AWAITING_CASH_CONFIRMATION,
    });
    repository.findByInvoiceAndIdempotency.mockResolvedValue(existing);

    const result = await service.initiate(
      customer(),
      INVOICE_ID,
      { method: PaymentMethod.CASH },
      'cash-request-1',
    );

    expect(repository.create).not.toHaveBeenCalled();
    expect(result.id).toBe(PAYMENT_ID);
  });

  it('rejects an invoice that has not been manager-confirmed', async () => {
    repository.lockInvoice.mockResolvedValue(
      invoice({ status: DineInInvoiceStatus.REQUESTED }),
    );

    await expect(
      service.initiate(
        customer(),
        INVOICE_ID,
        { method: PaymentMethod.CASH },
        'cash-request-2',
      ),
    ).rejects.toEqual(expect.any(ConflictException));
  });

  it('creates a Razorpay order for UPI without accepting a client amount', async () => {
    repository.lockPayment.mockResolvedValue(
      payment({
        method: PaymentMethod.UPI,
        gateway: 'RAZORPAY',
        status: PaymentStatus.PROCESSING,
      }),
    );
    const result = await service.initiate(
      customer(),
      INVOICE_ID,
      { method: PaymentMethod.UPI },
      'upi-request-1',
    );

    expect(gateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 70250, currency: 'INR' }),
    );
    expect(result.checkout).toEqual(
      expect.objectContaining({ orderId: 'order_test', amountPaise: 70250 }),
    );
  });

  it('rejects an invalid Razorpay callback signature without completing payment', async () => {
    gateway.verifyCheckoutSignature.mockReturnValue(false);
    repository.findForCustomer.mockResolvedValue(
      payment({
        method: PaymentMethod.UPI,
        gatewayOrderId: 'order_test',
        status: PaymentStatus.PENDING,
      }),
    );

    await expect(
      service.verify(customer(), PAYMENT_ID, {
        gatewayOrderId: 'order_test',
        gatewayPaymentId: 'pay_test',
        gatewaySignature: 'invalid',
      }),
    ).rejects.toEqual(expect.any(BadRequestException));
    expect(repository.saveInvoice).not.toHaveBeenCalled();
  });

  it('verifies a captured Razorpay payment and completes invoice and session once', async () => {
    const onlinePayment = payment({
      method: PaymentMethod.CARD,
      gatewayOrderId: 'order_test',
      status: PaymentStatus.PENDING,
    });
    repository.findForCustomer.mockResolvedValue(onlinePayment);
    repository.lockPayment.mockResolvedValue(onlinePayment);

    const result = await service.verify(customer(), PAYMENT_ID, {
      gatewayOrderId: 'order_test',
      gatewayPaymentId: 'pay_test',
      gatewaySignature: 'signature',
    });

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(repository.saveInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ status: DineInInvoiceStatus.PAID }),
      expect.anything(),
    );
    expect(repository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: DineInSessionStatus.COMPLETED }),
      expect.anything(),
    );
  });

  it('allows the restaurant owner to confirm cash and safely repeats confirmation', async () => {
    const cash = payment({
      method: PaymentMethod.CASH,
      status: PaymentStatus.AWAITING_CASH_CONFIRMATION,
    });
    repository.findById.mockResolvedValue(cash);
    repository.lockPayment.mockResolvedValue(cash);

    const result = await service.confirmCash(
      owner(),
      RESTAURANT_ID,
      PAYMENT_ID,
    );
    expect(result.status).toBe(PaymentStatus.SUCCESS);

    cash.status = PaymentStatus.SUCCESS;
    repository.findById.mockResolvedValue(cash);
    repository.lockPayment.mockResolvedValue(cash);
    const repeated = await service.confirmCash(
      owner(),
      RESTAURANT_ID,
      PAYMENT_ID,
    );
    expect(repeated.status).toBe(PaymentStatus.SUCCESS);
  });

  it('denies a manager who does not own the payment restaurant', async () => {
    restaurants.findOneForManagement.mockResolvedValue({
      id: RESTAURANT_ID,
      ownerId: OWNER_ID,
    });

    await expect(
      service.confirmCash(otherOwner(), RESTAURANT_ID, PAYMENT_ID),
    ).rejects.toEqual(expect.any(ForbiddenException));
  });

  it('rejects cash without changing the payment-pending invoice or session', async () => {
    const cash = payment({
      method: PaymentMethod.CASH,
      status: PaymentStatus.AWAITING_CASH_CONFIRMATION,
    });
    repository.lockPayment.mockResolvedValue(cash);

    const result = await service.rejectCash(
      owner(),
      RESTAURANT_ID,
      PAYMENT_ID,
      {
        reason: 'Cash was not received.',
      },
    );

    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(repository.saveInvoice).not.toHaveBeenCalled();
    expect(repository.saveSession).not.toHaveBeenCalled();
  });

  it('ignores a replayed Razorpay webhook event before mutation', async () => {
    repository.findByGatewayEventId.mockResolvedValue(payment());

    await service.handleRazorpayWebhook({
      rawBody: '{}',
      signature: 'valid',
      eventId: 'evt_once',
      payload: { event: 'payment.captured' },
    });

    expect(repository.findByGatewayOrderId).not.toHaveBeenCalled();
  });

  it('rejects an unsigned or invalid Razorpay webhook', async () => {
    gateway.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleRazorpayWebhook({
        rawBody: '{}',
        signature: 'invalid',
        eventId: 'evt_invalid',
        payload: { event: 'payment.captured' },
      }),
    ).rejects.toEqual(expect.any(ForbiddenException));
  });
});

function customer(): User {
  return {
    id: CUSTOMER_ID,
    isActive: true,
    role: UserRole.CUSTOMER,
  } as User;
}

function owner(): User {
  return {
    id: OWNER_ID,
    isActive: true,
    role: UserRole.RESTAURANT_OWNER,
  } as User;
}

function otherOwner(): User {
  return {
    id: OTHER_OWNER_ID,
    isActive: true,
    role: UserRole.RESTAURANT_OWNER,
  } as User;
}

function invoice(overrides: Partial<DineInInvoice> = {}): DineInInvoice {
  return {
    id: INVOICE_ID,
    invoiceNumber: 'DIN-INV-TEST',
    dineInSessionId: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: '80000000-0000-4000-8000-000000000001',
    customerUserId: CUSTOMER_ID,
    status: DineInInvoiceStatus.PAYMENT_PENDING,
    subtotalPaise: 70250,
    taxPaise: 0,
    serviceChargePaise: 0,
    discountPaise: 0,
    totalPaise: 70250,
    currency: 'INR',
    itemCount: 2,
    orderCount: 1,
    billingSnapshot: { orders: [] },
    requestedAt: new Date('2026-01-01T00:00:00.000Z'),
    confirmedAt: new Date('2026-01-01T00:01:00.000Z'),
    paidAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function session(overrides: Partial<DineInSession> = {}): DineInSession {
  return {
    id: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: '80000000-0000-4000-8000-000000000001',
    openedByUserId: CUSTOMER_ID,
    sessionNumber: 'DIN-SESSION-TEST',
    status: DineInSessionStatus.PAYMENT_PENDING,
    guestCount: 1,
    currentRoundNumber: 1,
    startedAt: new Date('2026-01-01T00:00:00.000Z'),
    billRequestedAt: new Date('2026-01-01T00:00:00.000Z'),
    paymentCompletedAt: null,
    completedAt: null,
    cancelledAt: null,
    closedAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function payment(overrides: Partial<DineInPayment> = {}): DineInPayment {
  return {
    id: PAYMENT_ID,
    paymentReference: 'DIN-PAY-TEST',
    invoiceId: INVOICE_ID,
    dineInSessionId: SESSION_ID,
    orderId: null,
    userId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    method: PaymentMethod.CASH,
    status: PaymentStatus.AWAITING_CASH_CONFIRMATION,
    amountPaise: 70250,
    currency: 'INR',
    gateway: null,
    gatewayOrderId: null,
    gatewayPaymentId: null,
    gatewaySignature: null,
    gatewayEventId: null,
    transactionReference: null,
    idempotencyKey: 'test-key',
    failureCode: null,
    failureReason: null,
    cashConfirmedByUserId: null,
    initiatedAt: new Date('2026-01-01T00:00:00.000Z'),
    completedAt: null,
    failedAt: null,
    paidAt: null,
    refundedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}
