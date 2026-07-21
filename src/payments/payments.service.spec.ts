import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Address, AddressLabel } from '../addresses/entities/address.entity';
import { AddressesService } from '../addresses/addresses.service';
import { CartItem } from '../cart/entities/cart-item.entity';
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
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { RazorpayDeliveryGatewayService } from './razorpay-delivery-gateway.service';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const RESTAURANT_ID = '30000000-0000-4000-8000-000000000001';
const CART_ID = '40000000-0000-4000-8000-000000000001';
const FOOD_ID = '50000000-0000-4000-8000-000000000001';
const ORDER_ID = '60000000-0000-4000-8000-000000000001';
const PAYMENT_ID = '70000000-0000-4000-8000-000000000001';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let repository: Record<string, jest.Mock>;
  let gateway: Record<string, jest.Mock>;
  let currentPayment: Payment;
  let currentOrder: Order;

  beforeEach(() => {
    currentOrder = order();
    currentPayment = payment();
    repository = {
      transaction: jest.fn(
        (operation: (manager: Record<string, never>) => Promise<unknown>) =>
          operation({}),
      ),
      lockCartForUser: jest.fn().mockResolvedValue(cart()),
      findByUserAndIdempotency: jest.fn().mockResolvedValue(null),
      findOpenForCustomer: jest.fn().mockResolvedValue(null),
      findLatestRetryableForCustomer: jest.fn().mockResolvedValue(null),
      findSuccessfulForOrder: jest.fn().mockResolvedValue(null),
      lockPayment: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentPayment)),
      lockOrder: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentOrder)),
      findPaymentForCustomer: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentPayment)),
      findByGatewayOrderId: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentPayment)),
      findWebhookEvent: jest.fn().mockResolvedValue(null),
      findOrderById: jest
        .fn()
        .mockImplementation(() => Promise.resolve(currentOrder)),
      createPayment: jest.fn((data: Partial<Payment>) => {
        currentPayment = payment(data);
        return currentPayment;
      }),
      createOrder: jest.fn((data: Partial<Order>) => {
        currentOrder = order(data);
        return currentOrder;
      }),
      createOrderItem: jest.fn((data: Record<string, unknown>) => data),
      createStatusHistory: jest.fn((data: Record<string, unknown>) => data),
      savePayment: jest.fn((entity: Payment) => {
        currentPayment = entity;
        return Promise.resolve(entity);
      }),
      saveOrder: jest.fn((entity: Order) => {
        currentOrder = entity;
        return Promise.resolve(entity);
      }),
      saveOrderItems: jest.fn((items: unknown[]) => Promise.resolve(items)),
      saveStatusHistory: jest.fn((history: unknown) =>
        Promise.resolve(history),
      ),
      deleteCartItemsForUser: jest.fn().mockResolvedValue(undefined),
      saveWebhookEvent: jest.fn((event: Record<string, unknown>) =>
        Promise.resolve({ id: 'webhook-id', ...event }),
      ),
      updateWebhookEvent: jest.fn().mockResolvedValue(undefined),
      saveTransactionLog: jest.fn().mockResolvedValue({ id: 'log-id' }),
      listForCustomer: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    gateway = {
      getPublicKey: jest.fn().mockReturnValue('rzp_test_public'),
      createOrder: jest.fn().mockResolvedValue({
        id: 'order_gateway',
        amount: 43800,
        currency: 'INR',
      }),
      verifyCheckoutSignature: jest.fn().mockReturnValue(true),
      fetchPayment: jest.fn().mockResolvedValue({
        id: 'pay_gateway',
        order_id: 'order_gateway',
        amount: 43800,
        currency: 'INR',
        status: 'captured',
        captured: true,
      }),
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    };
    service = new PaymentsService(
      repository as unknown as PaymentsRepository,
      {
        findActiveAddressForUser: jest.fn().mockResolvedValue(address()),
      } as unknown as AddressesService,
      gateway as unknown as RazorpayDeliveryGatewayService,
    );
  });

  it('creates a delivery order and Razorpay order from trusted cart totals', async () => {
    const result = await service.createRazorpayOrder(
      customer(),
      { deliveryAddressId: ADDRESS_ID, method: PaymentMethod.UPI },
      'order-create-1',
    );

    expect(repository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: USER_ID,
        restaurantId: RESTAURANT_ID,
        itemTotalPaise: 39800,
        deliveryFeePaise: 4000,
        grandTotalPaise: 43800,
        paymentMethod: PaymentMethod.UPI,
        paymentStatus: PaymentStatus.PENDING,
        orderType: OrderType.DELIVERY,
      }),
      expect.anything(),
    );
    expect(gateway.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        amountPaise: 43800,
        currency: 'INR',
        orderId: ORDER_ID,
        userId: USER_ID,
      }),
    );
    expect(result.checkout).toEqual(
      expect.objectContaining({
        keyId: 'rzp_test_public',
        orderId: 'order_gateway',
        amountPaise: 43800,
      }),
    );
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('places a Cash on Delivery order, creates a COD payment, and clears the cart', async () => {
    const result = await service.placeCodOrder(
      customer(),
      { addressId: ADDRESS_ID },
      'cod-request-1',
    );

    expect(repository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
        grandTotalPaise: 43800,
      }),
      expect.anything(),
    );
    expect(repository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        method: PaymentMethod.CASH_ON_DELIVERY,
        status: PaymentStatus.PENDING,
        gateway: 'COD',
        amountPaise: 43800,
      }),
      expect.anything(),
    );
    expect(repository.deleteCartItemsForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        orderId: ORDER_ID,
        paymentMethod: 'COD',
        paymentStatus: PaymentStatus.PENDING,
        orderStatus: OrderStatus.PLACED,
        totalPaise: 43800,
      },
    });
    expect(gateway.createOrder).not.toHaveBeenCalled();
  });

  it('rejects COD order placement when the cart is empty', async () => {
    repository.lockCartForUser.mockResolvedValue(cart({ items: [] }));

    await expect(
      service.placeCodOrder(
        customer(),
        { addressId: ADDRESS_ID },
        'cod-request-empty',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('rejects malformed manual UPI IDs on the compatibility endpoint', async () => {
    await expect(
      service.createFromCompatibleRequest(
        customer(),
        {
          addressId: ADDRESS_ID,
          paymentMethod: 'UPI',
          upiId: 'bad value',
        },
        'upi-invalid-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.createOrder).not.toHaveBeenCalled();
  });

  it('prevents a second open payment attempt for the customer', async () => {
    repository.findOpenForCustomer.mockResolvedValue(
      payment({ status: PaymentStatus.PENDING }),
    );

    await expect(
      service.createRazorpayOrder(
        customer(),
        { deliveryAddressId: ADDRESS_ID, method: PaymentMethod.CARD },
        'order-create-2',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects invalid Razorpay checkout signatures', async () => {
    currentPayment = payment({
      method: PaymentMethod.UPI,
      status: PaymentStatus.PENDING,
      gatewayOrderId: 'order_gateway',
    });
    gateway.verifyCheckoutSignature.mockReturnValue(false);

    await expect(
      service.verify(customer(), PAYMENT_ID, {
        gatewayOrderId: 'order_gateway',
        gatewayPaymentId: 'pay_gateway',
        gatewaySignature: 'bad-signature',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.deleteCartItemsForUser).not.toHaveBeenCalled();
  });

  it('verifies compatible Razorpay payloads by gateway order ID', async () => {
    currentPayment = payment({
      method: PaymentMethod.UPI,
      status: PaymentStatus.PENDING,
      gatewayOrderId: 'order_gateway',
    });

    const result = await service.verifyByGatewayReference(customer(), {
      razorpayOrderId: 'order_gateway',
      razorpayPaymentId: 'pay_gateway',
      razorpaySignature: 'valid-signature',
    });

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(gateway.verifyCheckoutSignature).toHaveBeenCalledWith({
      orderId: 'order_gateway',
      paymentId: 'pay_gateway',
      signature: 'valid-signature',
    });
  });

  it('marks captured payments successful and updates the delivery order payment status', async () => {
    currentPayment = payment({
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
      gatewayOrderId: 'order_gateway',
    });
    currentOrder = order({ paymentStatus: PaymentStatus.PENDING });

    const result = await service.verify(customer(), PAYMENT_ID, {
      gatewayOrderId: 'order_gateway',
      gatewayPaymentId: 'pay_gateway',
      gatewaySignature: 'valid-signature',
    });

    expect(result.status).toBe(PaymentStatus.SUCCESS);
    expect(result.orderPaymentStatus).toBe(PaymentStatus.SUCCESS);
    expect(repository.savePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        status: PaymentStatus.SUCCESS,
        gatewayPaymentId: 'pay_gateway',
        gatewaySignature: 'valid-signature',
      }),
      expect.anything(),
    );
    expect(repository.saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({ paymentStatus: PaymentStatus.SUCCESS }),
      expect.anything(),
    );
    expect(repository.deleteCartItemsForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it('records checkout failure and leaves successful payments unchanged', async () => {
    currentPayment = payment({
      status: PaymentStatus.PENDING,
      gatewayOrderId: 'order_gateway',
    });

    const failed = await service.recordFailure(customer(), PAYMENT_ID, {
      code: 'USER_CANCELLED',
      reason: 'Customer closed checkout.',
    });

    expect(failed.status).toBe(PaymentStatus.FAILED);
    expect(failed.orderPaymentStatus).toBe(PaymentStatus.FAILED);
  });

  it('ignores replayed webhook event IDs before mutating payments', async () => {
    repository.findWebhookEvent.mockResolvedValue({ id: 'event-id' });

    await service.handleRazorpayWebhook({
      rawBody: '{}',
      signature: 'valid',
      eventId: 'evt_once',
      payload: { event: 'payment.captured' },
    });

    expect(repository.findByGatewayOrderId).not.toHaveBeenCalled();
  });

  it('rejects invalid webhook signatures', async () => {
    gateway.verifyWebhookSignature.mockReturnValue(false);

    await expect(
      service.handleRazorpayWebhook({
        rawBody: '{}',
        signature: 'invalid',
        eventId: 'evt_invalid',
        payload: { event: 'payment.captured' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

function customer(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    role: UserRole.CUSTOMER,
    isActive: true,
    ...overrides,
  } as User;
}

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: RESTAURANT_ID,
    ownerId: '80000000-0000-4000-8000-000000000001',
    name: 'Pizza Palace',
    slug: 'pizza-palace',
    description: null,
    phone: null,
    email: null,
    logoUrl: null,
    bannerUrl: null,
    addressLine: '12 Main Road',
    locality: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    rating: 4.5,
    reviewCount: 12,
    averageDeliveryMinutes: 30,
    deliveryFeePaise: 4000,
    minimumOrderPaise: 10000,
    serviceRadiusKm: 5,
    isOpen: true,
    isActive: true,
    isPureVeg: false,
    status: RestaurantStatus.APPROVED,
    openingTime: null,
    closingTime: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  } as Restaurant;
}

function cart(overrides: Partial<Cart> = {}): Cart {
  const persistedRestaurant = restaurant();
  return {
    id: CART_ID,
    userId: USER_ID,
    restaurantId: RESTAURANT_ID,
    restaurant: persistedRestaurant,
    couponCode: null,
    items: [cartItem({ food: food(persistedRestaurant) })],
    ...overrides,
  } as Cart;
}

function cartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: '90000000-0000-4000-8000-000000000001',
    cartId: CART_ID,
    foodItemId: FOOD_ID,
    food: food(restaurant()),
    quantity: 2,
    unitPricePaise: 19900,
    instructions: null,
    ...overrides,
  } as CartItem;
}

function food(persistedRestaurant: Restaurant) {
  return {
    id: FOOD_ID,
    restaurantId: persistedRestaurant.id,
    restaurant: persistedRestaurant,
    name: 'Margherita Pizza',
    description: 'Cheese pizza',
    imageUrl: null,
    pricePaise: 19900,
    isActive: true,
    isAvailable: true,
  };
}

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: ADDRESS_ID,
    userId: USER_ID,
    label: AddressLabel.HOME,
    recipientName: 'Customer',
    phone: '+919876543210',
    addressLine: '12 Main Road',
    locality: 'Indiranagar',
    landmark: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    latitude: 12.98,
    longitude: 77.6,
    isActive: true,
    isDefault: true,
    ...overrides,
  } as Address;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    orderNumber: 'DEL-ORD-TEST',
    customerId: USER_ID,
    restaurantId: RESTAURANT_ID,
    deliveryPartnerId: null,
    deliveryAddressId: ADDRESS_ID,
    recipientNameSnapshot: 'Customer',
    recipientPhoneSnapshot: '+919876543210',
    deliveryAddressSnapshot: '12 Main Road',
    deliveryLatitude: 12.98,
    deliveryLongitude: 77.6,
    itemTotalPaise: 39800,
    deliveryFeePaise: 4000,
    platformFeePaise: 0,
    taxPaise: 0,
    discountPaise: 0,
    grandTotalPaise: 43800,
    paymentMethod: PaymentMethod.UPI,
    paymentStatus: PaymentStatus.PENDING,
    orderStatus: OrderStatus.PLACED,
    couponCode: null,
    deliveryInstructions: null,
    cancellationReason: null,
    estimatedDeliveryAt: new Date('2026-07-18T00:30:00.000Z'),
    acceptedAt: null,
    preparedAt: null,
    pickedUpAt: null,
    deliveredAt: null,
    cancelledAt: null,
    orderType: OrderType.DELIVERY,
    dineInSessionId: null,
    restaurantTableId: null,
    orderRoundNumber: null,
    dineInStatus: null,
    approvedAt: null,
    rejectedAt: null,
    preparationStartedAt: null,
    readyAt: null,
    servedAt: null,
    rejectionReason: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: PAYMENT_ID,
    paymentReference: 'DEL-PAY-TEST',
    invoiceId: null,
    dineInSessionId: null,
    orderId: ORDER_ID,
    userId: USER_ID,
    restaurantId: RESTAURANT_ID,
    method: PaymentMethod.UPI,
    status: PaymentStatus.PROCESSING,
    amountPaise: 43800,
    currency: 'INR',
    gateway: 'RAZORPAY',
    gatewayOrderId: null,
    gatewayPaymentId: null,
    gatewaySignature: null,
    gatewayEventId: null,
    transactionReference: null,
    idempotencyKey: 'test-key',
    failureCode: null,
    failureReason: null,
    cashConfirmedByUserId: null,
    initiatedAt: new Date('2026-07-18T00:00:00.000Z'),
    completedAt: null,
    failedAt: null,
    paidAt: null,
    refundedAt: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}
