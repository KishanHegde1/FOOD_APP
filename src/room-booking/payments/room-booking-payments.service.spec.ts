/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await, @typescript-eslint/unbound-method */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';
import {
  HotelBookingStatus,
  HotelPaymentMethod,
  HotelPaymentStatus,
} from '../common/enums/room-booking.enums';
import { BookingStatusHistory } from '../bookings/entities/booking-status-history.entity';
import { HotelBooking } from '../bookings/entities/hotel-booking.entity';
import { HotelBookingPayment } from './entities/hotel-booking-payment.entity';
import { HotelBookingPaymentTransactionLog } from './entities/hotel-booking-payment-transaction-log.entity';
import { HotelBookingPaymentWebhookEvent } from './entities/hotel-booking-payment-webhook-event.entity';
import { RoomBookingPaymentsService } from './room-booking-payments.service';

describe('RoomBookingPaymentsService', () => {
  const user = { id: '11111111-1111-4111-8111-111111111111' } as User;
  const now = new Date('2030-01-01T00:00:00.000Z');

  function paymentFixture(): HotelBookingPayment {
    return {
      id: 'payment-id',
      paymentReference: 'HBP-TEST-REFERENCE',
      bookingId: 'booking-id',
      userId: user.id,
      paymentMethod: HotelPaymentMethod.RAZORPAY,
      status: HotelPaymentStatus.PENDING,
      amountPaise: 220000,
      currency: 'INR',
      gateway: 'RAZORPAY',
      gatewayOrderId: 'order_test',
      gatewayPaymentId: null,
      gatewaySignature: null,
      gatewayEventId: null,
      idempotencyKey: 'idempotency-1',
      failureCode: null,
      failureReason: null,
      initiatedAt: now,
      paidAt: null,
      failedAt: null,
      createdAt: now,
      updatedAt: now,
    } as HotelBookingPayment;
  }

  function bookingFixture(): HotelBooking {
    return {
      id: 'booking-id',
      bookingNumber: 'HB-20300101-ABC123',
      userId: user.id,
      hotelId: 'hotel-id',
      roomId: 'room-id',
      checkInDate: '2030-08-01',
      checkOutDate: '2030-08-03',
      numberOfNights: 2,
      roomCount: 1,
      adultCount: 2,
      childCount: 0,
      contactName: 'Asha Sharma',
      contactPhone: '+918888888888',
      contactEmail: null,
      specialRequests: null,
      paymentMethod: HotelPaymentMethod.RAZORPAY,
      paymentStatus: HotelPaymentStatus.PENDING,
      bookingStatus: HotelBookingStatus.PENDING,
      currency: 'INR',
      nightlyPriceBreakdown: [],
      subtotal: '2000.00',
      taxAmount: '200.00',
      discountAmount: '0.00',
      totalAmount: '2200.00',
      cancellationReason: null,
      confirmedAt: null,
      cancelledAt: null,
      checkedInAt: null,
      checkedOutAt: null,
      createdAt: now,
      updatedAt: now,
    } as HotelBooking;
  }

  function createService() {
    const payment = paymentFixture();
    const booking = bookingFixture();
    const lock = (value: unknown) => ({
      where: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(value),
    });
    const managerPayments = {
      createQueryBuilder: jest.fn(() => lock(payment)),
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (value) => value),
      create: jest.fn((value) => value),
    };
    const managerBookings = {
      createQueryBuilder: jest.fn(() => lock(booking)),
      save: jest.fn(async (value) => value),
    };
    const managerHistory = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const managerLogs = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === HotelBookingPayment) return managerPayments;
        if (entity === HotelBooking) return managerBookings;
        if (entity === BookingStatusHistory) return managerHistory;
        if (entity === HotelBookingPaymentTransactionLog) return managerLogs;
        throw new Error('Unexpected repository');
      }),
    };
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };
    const paymentsRepository = {
      findOne: jest.fn().mockResolvedValue(payment),
    };
    const bookingsRepository = {
      findOne: jest.fn().mockResolvedValue(booking),
    };
    const webhookEventsRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const razorpayGateway = {
      getPublicKey: jest.fn().mockReturnValue('rzp_test_key'),
      verifyCheckoutSignature: jest.fn().mockReturnValue(true),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
      fetchPayment: jest.fn().mockResolvedValue({
        id: 'pay_test',
        order_id: 'order_test',
        amount: 220000,
        currency: 'INR',
        status: 'captured',
        captured: true,
      }),
    };
    const service = new RoomBookingPaymentsService(
      dataSource as never,
      paymentsRepository as never,
      bookingsRepository as never,
      webhookEventsRepository as never,
      razorpayGateway as never,
    );
    return {
      service,
      payment,
      booking,
      managerPayments,
      managerBookings,
      managerHistory,
      razorpayGateway,
    };
  }

  it('verifies a captured Razorpay payment and confirms the pending room booking', async () => {
    const {
      service,
      payment,
      booking,
      managerPayments,
      managerBookings,
      managerHistory,
      razorpayGateway,
    } = createService();

    const result = await service.verify(user, booking.id, {
      razorpayOrderId: 'order_test',
      razorpayPaymentId: 'pay_test',
      razorpaySignature: 'signature',
    });

    expect(razorpayGateway.verifyCheckoutSignature).toHaveBeenCalled();
    expect(payment.status).toBe(HotelPaymentStatus.PAID);
    expect(payment.gatewayPaymentId).toBe('pay_test');
    expect(booking.bookingStatus).toBe(HotelBookingStatus.CONFIRMED);
    expect(booking.paymentStatus).toBe(HotelPaymentStatus.PAID);
    expect(managerPayments.save).toHaveBeenCalledWith(payment);
    expect(managerBookings.save).toHaveBeenCalledWith(booking);
    expect(managerHistory.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: HotelBookingStatus.CONFIRMED }),
    );
    expect(result.payment).toBe(payment);
  });

  it('rejects a verification callback with an invalid Razorpay signature', async () => {
    const { service, booking, razorpayGateway } = createService();
    razorpayGateway.verifyCheckoutSignature.mockReturnValue(false);

    await expect(
      service.verify(user, booking.id, {
        razorpayOrderId: 'order_test',
        razorpayPaymentId: 'pay_test',
        razorpaySignature: 'bad-signature',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsigned Razorpay room-booking webhooks before database processing', async () => {
    const { service, razorpayGateway } = createService();
    razorpayGateway.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleRazorpayWebhook({
        rawBody: '{}',
        signature: 'invalid',
        eventId: 'event-id',
        payload: {},
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
