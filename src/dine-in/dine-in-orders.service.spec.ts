import { ConflictException } from '@nestjs/common';
import { Food } from '../foods/entities/food.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { DineInOrdersRepository } from './dine-in-orders.repository';
import { DineInOrdersService } from './dine-in-orders.service';
import { DineInSessionOrdersQueryDto } from './dto/dine-in-session-orders-query.dto';
import { DineInSession } from './entities/dine-in-session.entity';
import { OrderItem } from './entities/order-item.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { OrderStatus, OrderType } from './enums/order.enums';
import { RestaurantTablesRepository } from './restaurant-tables.repository';
import { DineInMenuAvailabilityService } from './dine-in-menu-availability.service';

type TransactionOperation = (manager: object) => Promise<unknown>;

describe('DineInOrdersService', () => {
  let service: DineInOrdersService;
  let ordersRepository: Record<string, jest.Mock>;
  let membersRepository: Record<string, jest.Mock>;
  let menuAvailability: Record<string, jest.Mock>;

  beforeEach(() => {
    ordersRepository = {
      transaction: jest.fn((operation: TransactionOperation) => operation({})),
      lockSession: jest.fn().mockResolvedValue(session()),
      findSessionById: jest.fn().mockResolvedValue(session()),
      findDetailedByOrderNumber: jest.fn().mockResolvedValue(null),
      findFoodsByIds: jest.fn().mockResolvedValue([food()]),
      saveSession: jest.fn((entity: DineInSession) => Promise.resolve(entity)),
      createOrder: jest.fn((data: Partial<Order>) => order(data)),
      saveOrder: jest.fn((entity: Order) => Promise.resolve(entity)),
      createItems: jest.fn((items: Partial<OrderItem>[]) =>
        items.map((item, index) =>
          itemEntity({ ...item, id: `item-${index}` }),
        ),
      ),
      saveItems: jest.fn((items: OrderItem[]) => Promise.resolve(items)),
      createHistory: jest.fn((entry: object) => entry),
      saveHistory: jest.fn((entry: object) => Promise.resolve(entry)),
      lockOrder: jest.fn().mockResolvedValue(order()),
      findTicketByOrderId: jest.fn().mockResolvedValue(null),
      createTicket: jest.fn((ticket: object) => ticket),
      saveTicket: jest.fn((ticket: object) => Promise.resolve(ticket)),
      listForSession: jest
        .fn()
        .mockResolvedValue({ items: [order()], total: 1 }),
      aggregateSessionOrders: jest.fn().mockResolvedValue({
        totalRounds: 4,
        activeOrderCount: 1,
        servedOrderCount: 1,
        rejectedOrderCount: 1,
        cancelledOrderCount: 1,
        subtotalPaise: 39800,
        taxPaise: 2000,
        serviceChargePaise: 1000,
        discountPaise: 0,
        payableTotalPaise: 42800,
      }),
      findDetailedBySessionAndId: jest.fn().mockResolvedValue(order()),
    };
    membersRepository = {
      findActiveMembership: jest.fn().mockResolvedValue({ id: 'membership' }),
      findMembership: jest.fn().mockResolvedValue({ id: 'membership' }),
    };
    const tablesRepository: Record<string, jest.Mock> = {
      findActiveByIdAndRestaurant: jest.fn().mockResolvedValue(table()),
      findById: jest.fn().mockResolvedValue(table()),
    };
    const restaurantsService: Record<string, jest.Mock> = {
      findOneForManagement: jest.fn().mockResolvedValue(restaurant()),
    };
    menuAvailability = {
      isAvailableNow: jest.fn().mockReturnValue(true),
    };
    service = new DineInOrdersService(
      ordersRepository as unknown as DineInOrdersRepository,
      membersRepository as unknown as DineInSessionMembersRepository,
      tablesRepository as unknown as RestaurantTablesRepository,
      restaurantsService as unknown as RestaurantsService,
      menuAvailability as unknown as DineInMenuAvailabilityService,
    );
  });

  it('creates one pending order from current database prices without a kitchen ticket', async () => {
    const response = await service.create(customer(), SESSION_ID, createDto());

    expect(response).toMatchObject({
      orderType: OrderType.DINE_IN,
      status: DineInOrderStatus.PENDING_APPROVAL,
      roundNumber: 1,
      pricing: { subtotalPaise: 39800, totalPaise: 39800 },
    });
    expect(ordersRepository.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        itemTotalPaise: 39800,
        grandTotalPaise: 39800,
        orderRoundNumber: 1,
        dineInStatus: DineInOrderStatus.PENDING_APPROVAL,
      }),
      expect.anything(),
    );
    expect(ordersRepository.saveTicket).not.toHaveBeenCalled();
    expect(ordersRepository.saveSession).toHaveBeenCalledWith(
      expect.objectContaining({ currentRoundNumber: 1 }),
      expect.anything(),
    );
  });

  it('returns the original order for the same customer, session, and idempotency key', async () => {
    const persisted = order({ orderNumber: 'DIN-ORD-EXISTING' });
    ordersRepository.findDetailedByOrderNumber.mockResolvedValue(persisted);

    await expect(
      service.create(customer(), SESSION_ID, createDto()),
    ).resolves.toMatchObject({
      id: persisted.id,
      orderNumber: persisted.orderNumber,
    });
    expect(ordersRepository.createOrder).not.toHaveBeenCalled();
    expect(ordersRepository.saveSession).not.toHaveBeenCalled();
  });

  it('rejects food which is no longer available before saving an order', async () => {
    ordersRepository.findFoodsByIds.mockResolvedValue([
      food({ isAvailable: false }),
    ]);

    await expect(
      service.create(customer(), SESSION_ID, createDto()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersRepository.createOrder).not.toHaveBeenCalled();
  });

  it('rejects a food outside its configured service window before saving an order', async () => {
    menuAvailability.isAvailableNow.mockReturnValue(false);

    await expect(
      service.create(customer(), SESSION_ID, createDto()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersRepository.createOrder).not.toHaveBeenCalled();
  });

  it('approves once and creates exactly one kitchen ticket in the transaction', async () => {
    const pendingOrder = order();
    ordersRepository.lockOrder.mockResolvedValue(pendingOrder);

    await expect(
      service.approve(owner(), RESTAURANT_ID, ORDER_ID),
    ).resolves.toMatchObject({
      id: ORDER_ID,
      status: DineInOrderStatus.APPROVED,
    });
    expect(ordersRepository.saveOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        dineInStatus: DineInOrderStatus.APPROVED,
        orderStatus: OrderStatus.ACCEPTED,
      }),
      expect.anything(),
    );
    expect(pendingOrder.approvedAt).toBeInstanceOf(Date);
    expect(ordersRepository.saveTicket).toHaveBeenCalledTimes(1);
    expect(ordersRepository.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: ORDER_ID,
        restaurantId: RESTAURANT_ID,
      }),
      expect.anything(),
    );
  });

  it('returns paginated historical rounds to a former session member', async () => {
    const query = Object.assign(new DineInSessionOrdersQueryDto(), {
      page: 2,
      limit: 1,
      includeItems: false,
    });
    ordersRepository.listForSession.mockResolvedValue({
      items: [
        order({
          orderRoundNumber: 2,
          dineInStatus: DineInOrderStatus.REJECTED,
        }),
      ],
      total: 2,
    });

    await expect(
      service.listForSession(customer(), SESSION_ID, query),
    ).resolves.toMatchObject({
      page: 2,
      limit: 1,
      total: 2,
      totalPages: 2,
      items: [{ roundNumber: 2, status: DineInOrderStatus.REJECTED }],
    });
    expect(membersRepository.findMembership).toHaveBeenCalledWith(
      SESSION_ID,
      CUSTOMER_ID,
    );
    expect(ordersRepository.listForSession).toHaveBeenCalledWith(
      SESSION_ID,
      query,
    );
  });

  it('calculates payable totals from approved-through-served snapshots only', async () => {
    await expect(
      service.getSessionSummary(customer(), SESSION_ID),
    ).resolves.toMatchObject({
      totalRounds: 4,
      activeOrderCount: 1,
      servedOrderCount: 1,
      rejectedOrderCount: 1,
      cancelledOrderCount: 1,
      pricing: {
        subtotalPaise: 39800,
        taxPaise: 2000,
        serviceChargePaise: 1000,
        payableTotalPaise: 42800,
      },
      canAddMoreItems: true,
    });
  });

  it('blocks another round after bill request while leaving history readable', async () => {
    ordersRepository.lockSession.mockResolvedValue(
      session({ status: DineInSessionStatus.BILL_REQUESTED }),
    );

    await expect(
      service.create(customer(), SESSION_ID, createDto()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(ordersRepository.createOrder).not.toHaveBeenCalled();
  });
});

const NOW = new Date('2026-07-18T00:00:00.000Z');
const CUSTOMER_ID = '10000000-0000-4000-8000-000000000001';
const OWNER_ID = '10000000-0000-4000-8000-000000000002';
const RESTAURANT_ID = '20000000-0000-4000-8000-000000000001';
const TABLE_ID = '30000000-0000-4000-8000-000000000001';
const SESSION_ID = '40000000-0000-4000-8000-000000000001';
const ORDER_ID = '50000000-0000-4000-8000-000000000001';
const FOOD_ID = '60000000-0000-4000-8000-000000000001';

function createDto() {
  return {
    idempotencyKey: 'retry-safe-key',
    items: [
      { foodItemId: FOOD_ID, quantity: 2, specialInstructions: 'Less spicy' },
    ],
  };
}

function customer(overrides: Partial<User> = {}): User {
  return {
    id: CUSTOMER_ID,
    name: 'Customer',
    phone: '+919876543210',
    role: UserRole.CUSTOMER,
    isActive: true,
    ...overrides,
  } as User;
}

function owner(): User {
  return customer({ id: OWNER_ID, role: UserRole.RESTAURANT_OWNER });
}

function restaurant(): Restaurant {
  return { id: RESTAURANT_ID, ownerId: OWNER_ID } as Restaurant;
}

function table(): RestaurantTable {
  return {
    id: TABLE_ID,
    restaurantId: RESTAURANT_ID,
    tableNumber: 'T01',
    displayName: 'Table 1',
    isActive: true,
  } as RestaurantTable;
}

function session(overrides: Partial<DineInSession> = {}): DineInSession {
  return {
    id: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: TABLE_ID,
    sessionNumber: 'DIN-20260718-ABCDEF',
    status: DineInSessionStatus.ACTIVE,
    currentRoundNumber: 0,
    ...overrides,
  } as DineInSession;
}

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: FOOD_ID,
    restaurantId: RESTAURANT_ID,
    name: 'Vegetable Soup',
    description: null,
    imageUrl: null,
    pricePaise: 19900,
    isActive: true,
    isAvailable: true,
    ...overrides,
  } as Food;
}

function itemEntity(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    foodItemId: FOOD_ID,
    foodNameSnapshot: 'Vegetable Soup',
    quantity: 2,
    unitPricePaise: 19900,
    subtotalPaise: 39800,
    instructions: null,
    ...overrides,
  } as OrderItem;
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    id: ORDER_ID,
    orderNumber: 'DIN-ORD-TEST',
    customerId: CUSTOMER_ID,
    restaurantId: RESTAURANT_ID,
    itemTotalPaise: 39800,
    taxPaise: 0,
    platformFeePaise: 0,
    discountPaise: 0,
    grandTotalPaise: 39800,
    orderType: OrderType.DINE_IN,
    orderStatus: OrderStatus.PLACED,
    dineInSessionId: SESSION_ID,
    restaurantTableId: TABLE_ID,
    orderRoundNumber: 1,
    dineInStatus: DineInOrderStatus.PENDING_APPROVAL,
    rejectionReason: null,
    approvedAt: null,
    rejectedAt: null,
    createdAt: NOW,
    dineInSession: session(),
    restaurantTable: table(),
    items: [itemEntity()],
    ...overrides,
  } as Order;
}
