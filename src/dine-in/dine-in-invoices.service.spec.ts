import { ConflictException } from '@nestjs/common';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { DineInInvoicesRepository } from './dine-in-invoices.repository';
import { DineInInvoicesService } from './dine-in-invoices.service';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import {
  DineInBillingSnapshot,
  DineInInvoice,
} from './entities/dine-in-invoice.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { OrderStatus, OrderType } from './enums/order.enums';
import { RestaurantTablesRepository } from './restaurant-tables.repository';

type TransactionOperation = (manager: object) => Promise<unknown>;

describe('DineInInvoicesService', () => {
  let service: DineInInvoicesService;
  let invoicesRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    invoicesRepository = {
      transaction: jest.fn((operation: TransactionOperation) => operation({})),
      lockSession: jest.fn().mockResolvedValue(session()),
      findSessionById: jest.fn().mockResolvedValue(session()),
      findInvoiceBySessionId: jest.fn().mockResolvedValue(null),
      findInvoiceById: jest.fn().mockResolvedValue(invoice()),
      lockInvoice: jest.fn().mockResolvedValue(invoice()),
      countUnfinishedOrders: jest.fn().mockResolvedValue(0),
      findBillableOrders: jest.fn().mockResolvedValue([servedOrder()]),
      create: jest.fn((data: Partial<DineInInvoice>) => invoice(data)),
      save: jest.fn((entity: DineInInvoice) => Promise.resolve(entity)),
      saveSession: jest.fn((entity: DineInSession) => Promise.resolve(entity)),
      findInvoiceForCustomer: jest.fn().mockResolvedValue(invoice()),
      listForCustomer: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      listForRestaurant: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const membersRepository: Record<string, jest.Mock> = {
      findActiveMembership: jest.fn().mockResolvedValue({ id: 'member' }),
      findMembership: jest.fn().mockResolvedValue({ id: 'member' }),
    };
    const restaurantsService: Record<string, jest.Mock> = {
      findOneForManagement: jest.fn().mockResolvedValue(restaurant()),
    };
    const tablesRepository: Record<string, jest.Mock> = {
      findById: jest.fn().mockResolvedValue(table()),
    };
    service = new DineInInvoicesService(
      invoicesRepository as unknown as DineInInvoicesRepository,
      membersRepository as unknown as DineInSessionMembersRepository,
      restaurantsService as unknown as RestaurantsService,
      tablesRepository as unknown as RestaurantTablesRepository,
    );
  });

  it('creates a requested bill from served order snapshots and locks the session', async () => {
    await expect(
      service.requestBill(customer(), SESSION_ID),
    ).resolves.toMatchObject({
      status: DineInInvoiceStatus.REQUESTED,
      orderCount: 1,
      itemCount: 2,
      pricing: { totalPaise: 39800, currency: 'INR' },
      session: { status: DineInSessionStatus.BILL_REQUESTED },
    });
    expect(invoicesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dineInSessionId: SESSION_ID,
        customerUserId: CUSTOMER_ID,
        status: DineInInvoiceStatus.REQUESTED,
        totalPaise: 39800,
      }),
      expect.anything(),
    );
    expect(invoicesRepository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: DineInSessionStatus.BILL_REQUESTED }),
      expect.anything(),
    );
  });

  it('rejects bill request while an order is not served', async () => {
    invoicesRepository.countUnfinishedOrders.mockResolvedValue(1);

    await expect(
      service.requestBill(customer(), SESSION_ID),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(invoicesRepository.create).not.toHaveBeenCalled();
  });

  it('returns the existing requested invoice for a duplicate bill request', async () => {
    const existing = invoice({ status: DineInInvoiceStatus.REQUESTED });
    invoicesRepository.lockSession.mockResolvedValue(
      session({ status: DineInSessionStatus.BILL_REQUESTED }),
    );
    invoicesRepository.findInvoiceBySessionId.mockResolvedValue(existing);

    await expect(
      service.requestBill(customer(), SESSION_ID),
    ).resolves.toMatchObject({
      id: existing.id,
      status: DineInInvoiceStatus.REQUESTED,
    });
    expect(invoicesRepository.create).not.toHaveBeenCalled();
  });

  it('confirms a frozen bill without marking it paid', async () => {
    const requested = invoice({ status: DineInInvoiceStatus.REQUESTED });
    invoicesRepository.lockInvoice.mockResolvedValue(requested);
    invoicesRepository.lockSession.mockResolvedValue(
      session({ status: DineInSessionStatus.BILL_REQUESTED }),
    );

    await expect(
      service.confirm(owner(), RESTAURANT_ID, INVOICE_ID),
    ).resolves.toMatchObject({
      status: DineInInvoiceStatus.PAYMENT_PENDING,
      session: { status: DineInSessionStatus.PAYMENT_PENDING },
      paidAt: null,
    });
    expect(requested.confirmedAt).toBeInstanceOf(Date);
    expect(invoicesRepository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ status: DineInSessionStatus.PAYMENT_PENDING }),
      expect.anything(),
    );
  });

  it('cancels a requested bill and reopens the ordering session', async () => {
    const requested = invoice({ status: DineInInvoiceStatus.REQUESTED });
    invoicesRepository.lockInvoice.mockResolvedValue(requested);
    invoicesRepository.lockSession.mockResolvedValue(
      session({ status: DineInSessionStatus.BILL_REQUESTED }),
    );

    await expect(
      service.cancelRequest(owner(), RESTAURANT_ID, INVOICE_ID, {
        reason: 'Adding another round',
      }),
    ).resolves.toMatchObject({
      status: DineInInvoiceStatus.CANCELLED,
      session: { status: DineInSessionStatus.ACTIVE },
    });
    expect(requested.billingSnapshot.requestHistory).toHaveLength(1);
  });
});

const NOW = new Date('2026-07-19T00:00:00.000Z');
const CUSTOMER_ID = '10000000-0000-4000-8000-000000000001';
const OWNER_ID = '10000000-0000-4000-8000-000000000002';
const RESTAURANT_ID = '20000000-0000-4000-8000-000000000001';
const TABLE_ID = '30000000-0000-4000-8000-000000000001';
const SESSION_ID = '40000000-0000-4000-8000-000000000001';
const INVOICE_ID = '50000000-0000-4000-8000-000000000001';
const ORDER_ID = '60000000-0000-4000-8000-000000000001';

function customer(overrides: Partial<User> = {}): User {
  return {
    id: CUSTOMER_ID,
    role: UserRole.CUSTOMER,
    isActive: true,
    ...overrides,
  } as User;
}

function owner(): User {
  return customer({ id: OWNER_ID, role: UserRole.RESTAURANT_OWNER });
}

function restaurant(): Restaurant {
  return {
    id: RESTAURANT_ID,
    ownerId: OWNER_ID,
    name: 'Good Food',
  } as Restaurant;
}

function table(): RestaurantTable {
  return {
    id: TABLE_ID,
    restaurantId: RESTAURANT_ID,
    tableNumber: 'T01',
  } as RestaurantTable;
}

function session(overrides: Partial<DineInSession> = {}): DineInSession {
  return {
    id: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: TABLE_ID,
    sessionNumber: 'DIN-20260719-ABCDEF',
    status: DineInSessionStatus.ACTIVE,
    currentRoundNumber: 1,
    billRequestedAt: null,
    ...overrides,
  } as DineInSession;
}

function snapshot(): DineInBillingSnapshot {
  return {
    sessionNumber: 'DIN-20260719-ABCDEF',
    restaurantName: 'Good Food',
    tableNumber: 'T01',
    orders: [
      {
        id: ORDER_ID,
        orderNumber: 'DIN-ORD-TEST',
        roundNumber: 1,
        status: DineInOrderStatus.SERVED,
        createdAt: NOW.toISOString(),
        items: [
          {
            id: 'item-1',
            foodItemId: null,
            name: 'Vegetable Soup',
            quantity: 2,
            unitPricePaise: 19900,
            totalPricePaise: 39800,
          },
        ],
        pricing: {
          subtotalPaise: 39800,
          taxPaise: 0,
          serviceChargePaise: 0,
          discountPaise: 0,
          totalPaise: 39800,
        },
      },
    ],
  };
}

function invoice(overrides: Partial<DineInInvoice> = {}): DineInInvoice {
  return {
    id: INVOICE_ID,
    invoiceNumber: 'DIN-INV-TEST',
    dineInSessionId: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: TABLE_ID,
    customerUserId: CUSTOMER_ID,
    status: DineInInvoiceStatus.REQUESTED,
    subtotalPaise: 39800,
    taxPaise: 0,
    serviceChargePaise: 0,
    discountPaise: 0,
    totalPaise: 39800,
    currency: 'INR',
    itemCount: 2,
    orderCount: 1,
    billingSnapshot: snapshot(),
    requestedAt: NOW,
    confirmedAt: null,
    paidAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function servedOrder(): Order {
  return {
    id: ORDER_ID,
    orderNumber: 'DIN-ORD-TEST',
    orderType: OrderType.DINE_IN,
    orderStatus: OrderStatus.READY_FOR_PICKUP,
    dineInStatus: DineInOrderStatus.SERVED,
    itemTotalPaise: 39800,
    taxPaise: 0,
    platformFeePaise: 0,
    discountPaise: 0,
    grandTotalPaise: 39800,
    orderRoundNumber: 1,
    createdAt: NOW,
    items: [
      {
        id: 'item-1',
        foodItemId: null,
        foodNameSnapshot: 'Vegetable Soup',
        quantity: 2,
        unitPricePaise: 19900,
        subtotalPaise: 39800,
      },
    ],
  } as Order;
}
