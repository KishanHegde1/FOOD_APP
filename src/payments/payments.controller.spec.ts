import {
  CanActivate,
  ExecutionContext,
  INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { FirebaseAuthGuard } from '../auth/guards/firebase-auth.guard';
import { PaymentMethod, PaymentStatus } from '../dine-in/enums/order.enums';
import { UsersService } from '../users/users.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

describe('PaymentsController', () => {
  let app: INestApplication;
  const paymentsService = {
    createRazorpayOrder: jest.fn(),
    createFromCompatibleRequest: jest.fn(),
    verifyByGatewayReference: jest.fn(),
  };
  const usersService = {
    findActiveByFirebaseUid: jest.fn().mockResolvedValue({
      id: '10000000-0000-4000-8000-000000000001',
      isActive: true,
    }),
  };

  beforeEach(async () => {
    paymentsService.createRazorpayOrder.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      paymentReference: 'DEL-PAY-TEST',
      orderId: '60000000-0000-4000-8000-000000000001',
      orderNumber: 'DEL-ORD-TEST',
      restaurantId: '30000000-0000-4000-8000-000000000001',
      method: PaymentMethod.UPI,
      status: PaymentStatus.PENDING,
      orderPaymentStatus: PaymentStatus.PENDING,
      amountPaise: 43800,
      currency: 'INR',
      checkout: {
        gateway: 'RAZORPAY',
        keyId: 'rzp_test_public',
        orderId: 'order_gateway',
        amountPaise: 43800,
        currency: 'INR',
        method: PaymentMethod.UPI,
      },
    });
    paymentsService.createFromCompatibleRequest.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      paymentReference: 'DEL-PAY-TEST',
      orderId: '60000000-0000-4000-8000-000000000001',
      orderNumber: 'DEL-ORD-TEST',
      restaurantId: '30000000-0000-4000-8000-000000000001',
      method: PaymentMethod.UPI,
      status: PaymentStatus.PENDING,
      orderPaymentStatus: PaymentStatus.PENDING,
      amountPaise: 43800,
      currency: 'INR',
      checkout: {
        gateway: 'RAZORPAY',
        keyId: 'rzp_test_public',
        orderId: 'order_gateway',
        amountPaise: 43800,
        currency: 'INR',
        method: PaymentMethod.UPI,
      },
    });
    paymentsService.verifyByGatewayReference.mockResolvedValue({
      id: '70000000-0000-4000-8000-000000000001',
      status: PaymentStatus.SUCCESS,
      orderPaymentStatus: PaymentStatus.SUCCESS,
    });

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [
        { provide: PaymentsService, useValue: paymentsService },
        { provide: UsersService, useValue: usersService },
      ],
    })
      .overrideGuard(FirebaseAuthGuard)
      .useClass(TestFirebaseGuard)
      .overrideGuard(ThrottlerGuard)
      .useClass(AllowGuard)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.clearAllMocks();
  });

  it('passes the authenticated user and idempotency key to payment creation', async () => {
    await request(app.getHttpServer() as Server)
      .post('/payments/razorpay/orders')
      .set('Idempotency-Key', 'create-payment-1')
      .send({
        deliveryAddressId: '20000000-0000-4000-8000-000000000001',
        method: PaymentMethod.UPI,
      })
      .expect(200)
      .expect(({ body }) => {
        const responseBody = body as { checkout?: Record<string, unknown> };
        expect(responseBody.checkout).toEqual(
          expect.objectContaining({
            keyId: 'rzp_test_public',
            orderId: 'order_gateway',
          }),
        );
        expect(JSON.stringify(body)).not.toContain('secret');
      });

    expect(paymentsService.createRazorpayOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000001' }),
      expect.objectContaining({
        deliveryAddressId: '20000000-0000-4000-8000-000000000001',
        method: PaymentMethod.UPI,
      }),
      'create-payment-1',
    );
  });

  it('rejects payment creation without an idempotency key', async () => {
    await request(app.getHttpServer() as Server)
      .post('/payments/razorpay/orders')
      .send({
        deliveryAddressId: '20000000-0000-4000-8000-000000000001',
        method: PaymentMethod.UPI,
      })
      .expect(400);

    expect(paymentsService.createRazorpayOrder).not.toHaveBeenCalled();
  });

  it('supports the Flutter compatibility payment-order endpoint', async () => {
    await request(app.getHttpServer() as Server)
      .post('/payments/orders')
      .set('X-Idempotency-Key', 'flutter-payment-1')
      .send({
        addressId: '20000000-0000-4000-8000-000000000001',
        paymentMethod: PaymentMethod.UPI,
        upiId: 'name@bank',
      })
      .expect(200);

    expect(paymentsService.createFromCompatibleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ id: '10000000-0000-4000-8000-000000000001' }),
      expect.objectContaining({
        addressId: '20000000-0000-4000-8000-000000000001',
        paymentMethod: PaymentMethod.UPI,
      }),
      'flutter-payment-1',
    );
  });

  it('supports compatibility verification without a payment ID path segment', async () => {
    await request(app.getHttpServer() as Server)
      .post('/payments/verify')
      .send({
        razorpayOrderId: 'order_gateway',
        razorpayPaymentId: 'pay_gateway',
        razorpaySignature: 'signature',
      })
      .expect(200);

    expect(paymentsService.verifyByGatewayReference).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        razorpayOrderId: 'order_gateway',
        razorpayPaymentId: 'pay_gateway',
      }),
    );
  });
});

class TestFirebaseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    context
      .switchToHttp()
      .getRequest<{ firebaseUser?: unknown }>().firebaseUser = {
      uid: 'firebase-user',
      phoneNumber: '+919876543210',
    };
    return true;
  }
}

class AllowGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
