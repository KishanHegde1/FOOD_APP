import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Food } from '../foods/entities/food.entity';
import { FoodsRepository } from '../foods/foods.repository';
import { MenuCategory } from '../menu-categories/entities/menu-category.entity';
import { MenuCategoriesRepository } from '../menu-categories/menu-categories.repository';
import {
  Restaurant,
  RestaurantStatus,
} from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateRestaurantTableDto } from './dto/create-restaurant-table.dto';
import { DineInMenuQueryDto } from './dto/dine-in-menu-query.dto';
import { StartDineInSessionDto } from './dto/start-dine-in-session.dto';
import { ValidateDineInQrDto } from './dto/validate-dine-in-qr.dto';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { DineInQrService } from './dine-in-qr.service';
import { DineInMenuAvailabilityService } from './dine-in-menu-availability.service';
import { DineInSessionsRepository } from './dine-in-sessions.repository';
import { DineInService } from './dine-in.service';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { DineInMemberRole } from './enums/dine-in-member-role.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { RestaurantTablesRepository } from './restaurant-tables.repository';

type TransactionOperation = (manager: object) => Promise<unknown>;

describe('DineInService', () => {
  let service: DineInService;
  let qrService: DineInQrService;
  let tablesRepository: Record<string, jest.Mock>;
  let sessionsRepository: Record<string, jest.Mock>;
  let membersRepository: Record<string, jest.Mock>;
  let restaurantsService: Record<string, jest.Mock>;
  let foodsRepository: Record<string, jest.Mock>;
  let categoriesRepository: Record<string, jest.Mock>;

  beforeEach(() => {
    qrService = new DineInQrService();
    tablesRepository = {
      create: jest.fn((data: Partial<RestaurantTable>) =>
        table(data, qrService),
      ),
      findById: jest.fn().mockResolvedValue(table({}, qrService)),
      findByQrHash: jest.fn().mockResolvedValue(table({}, qrService)),
      findByRestaurantAndTableNumber: jest.fn().mockResolvedValue(null),
      listByRestaurant: jest.fn().mockResolvedValue([]),
      lockById: jest.fn().mockResolvedValue(table({}, qrService)),
      save: jest.fn((entity: RestaurantTable) => Promise.resolve(entity)),
    };
    sessionsRepository = {
      create: jest.fn((data: Partial<DineInSession>) => session(data)),
      findActiveByTable: jest.fn().mockResolvedValue(null),
      findById: jest.fn().mockResolvedValue(session()),
      findCurrentForUser: jest.fn().mockResolvedValue(null),
      lockUserById: jest.fn().mockResolvedValue(customer()),
      save: jest.fn((entity: DineInSession) => Promise.resolve(entity)),
      transaction: jest.fn((operation: TransactionOperation) => operation({})),
    };
    membersRepository = {
      createGuest: jest.fn((dineInSessionId: string, userId: string) =>
        membership({
          dineInSessionId,
          userId,
          memberRole: DineInMemberRole.GUEST,
        }),
      ),
      createHost: jest.fn((dineInSessionId: string, userId: string) =>
        membership({
          dineInSessionId,
          userId,
          memberRole: DineInMemberRole.HOST,
        }),
      ),
      deactivate: jest.fn((entity: DineInSessionMember) => {
        entity.isActive = false;
        return Promise.resolve(entity);
      }),
      findActiveMembership: jest.fn().mockResolvedValue(null),
      findMembership: jest.fn().mockResolvedValue(null),
      reactivate: jest.fn((entity: DineInSessionMember) => {
        entity.isActive = true;
        return Promise.resolve(entity);
      }),
      save: jest.fn((entity: DineInSessionMember) => Promise.resolve(entity)),
    };
    restaurantsService = {
      findOneForManagement: jest.fn().mockResolvedValue(restaurant()),
    };
    foodsRepository = {
      findByRestaurantId: jest
        .fn()
        .mockResolvedValue({ items: [food()], total: 1 }),
      findActiveMenuByRestaurantId: jest.fn().mockResolvedValue([food()]),
    };
    categoriesRepository = {
      findPublicByRestaurantId: jest.fn().mockResolvedValue([category()]),
    };
    service = new DineInService(
      tablesRepository as unknown as RestaurantTablesRepository,
      sessionsRepository as unknown as DineInSessionsRepository,
      membersRepository as unknown as DineInSessionMembersRepository,
      qrService,
      restaurantsService as unknown as RestaurantsService,
      foodsRepository as unknown as FoodsRepository,
      categoriesRepository as unknown as MenuCategoriesRepository,
      new DineInMenuAvailabilityService(),
    );
  });

  it('validates a QR without exposing its raw token or stored hash', async () => {
    const response = await service.scan(customer(), qrDto());

    expect(response).toMatchObject({
      valid: true,
      restaurant: { id: RESTAURANT_ID, name: 'Good Food' },
      table: { id: TABLE_ID, tableNumber: 'T01', capacity: 4 },
      activeSession: null,
      categories: [{ name: 'Starters', items: [{ name: 'Vegetable Soup' }] }],
    });
    expect(JSON.stringify(response)).not.toContain(RAW_TOKEN);
    expect(response).not.toHaveProperty('qrTokenHash');
  });

  it('resolves a QR token to its saved table without exposing the token', async () => {
    const response = await service.scanByToken(customer(), RAW_TOKEN);

    expect(tablesRepository.findByQrHash).toHaveBeenCalledWith(
      qrService.hashToken(RAW_TOKEN),
    );
    expect(response.table).toMatchObject({
      id: TABLE_ID,
      tableNumber: 'T01',
    });
    expect(JSON.stringify(response)).not.toContain(RAW_TOKEN);
  });

  it('resolves the complete mobile-scanner deep link without exposing its token', async () => {
    const deepLink = qrService.createDeepLink(
      RESTAURANT_ID,
      TABLE_ID,
      1,
      RAW_TOKEN,
    );

    const response = await service.scanQrPayload(customer(), deepLink);

    expect(response).toMatchObject({
      valid: true,
      restaurant: { id: RESTAURANT_ID },
      table: { id: TABLE_ID },
    });
    expect(JSON.stringify(response)).not.toContain(RAW_TOKEN);
  });

  it.each([
    ['invalid token', () => qrDto({ token: 'incorrect-token' })],
    ['wrong QR version', () => qrDto({ version: 2 })],
  ])('rejects a scan with an %s', async (_, createDto) => {
    const dto = createDto();
    await expect(service.scan(customer(), dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects table and restaurant mismatches before creating a session', async () => {
    await expect(
      service.startSession(
        customer(),
        startDto({ restaurantId: OTHER_RESTAURANT_ID }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sessionsRepository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['inactive table', () => table({ isActive: false }, qrService)],
    ['inactive restaurant', () => table({}, qrService)],
  ])('rejects an %s QR code', async (kind, createTable) => {
    const persistedTable = createTable();
    tablesRepository.findById.mockResolvedValue(persistedTable);
    tablesRepository.lockById.mockResolvedValue(persistedTable);
    if (kind === 'inactive restaurant') {
      restaurantsService.findOneForManagement.mockResolvedValue(
        restaurant({ isActive: false }),
      );
    }

    await expect(service.scan(customer(), qrDto())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('creates the first session with a HOST membership inside a transaction', async () => {
    const response = await service.startSession(customer(), startDto());

    expect(sessionsRepository.transaction).toHaveBeenCalledTimes(1);
    expect(sessionsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: RESTAURANT_ID,
        restaurantTableId: TABLE_ID,
        openedByUserId: CUSTOMER_ID,
        status: DineInSessionStatus.ACTIVE,
        guestCount: 2,
      }),
      expect.anything(),
    );
    expect(membersRepository.createHost).toHaveBeenCalledWith(
      SESSION_ID,
      CUSTOMER_ID,
      expect.anything(),
    );
    expect(response).toMatchObject({ memberRole: DineInMemberRole.HOST });
  });

  it('resumes an existing table session instead of creating another one', async () => {
    const existing = session();
    sessionsRepository.findActiveByTable.mockResolvedValue(existing);
    membersRepository.findMembership.mockResolvedValue(
      membership({ memberRole: DineInMemberRole.HOST }),
    );

    await expect(
      service.startSession(customer(), startDto()),
    ).resolves.toMatchObject({
      id: SESSION_ID,
      memberRole: DineInMemberRole.HOST,
    });
    expect(sessionsRepository.create).not.toHaveBeenCalled();
  });

  it('retries a normal active-session unique race and resumes the winner', async () => {
    const existing = session();
    sessionsRepository.findActiveByTable
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    sessionsRepository.transaction
      .mockImplementationOnce(async (operation: TransactionOperation) => {
        await operation({});
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      })
      .mockImplementation((operation: TransactionOperation) => operation({}));
    membersRepository.findMembership.mockResolvedValue(
      membership({ memberRole: DineInMemberRole.HOST }),
    );

    await expect(
      service.startSession(customer(), startDto()),
    ).resolves.toMatchObject({
      id: SESSION_ID,
    });
    expect(sessionsRepository.transaction).toHaveBeenCalledTimes(2);
  });

  it('allows another customer to join the same active table safely', async () => {
    const guest = customer({ id: GUEST_ID, firebaseUid: 'firebase-guest' });
    const existing = session();
    sessionsRepository.findActiveByTable.mockResolvedValue(existing);
    sessionsRepository.lockUserById.mockResolvedValue(guest);

    await expect(
      service.startSession(guest, startDto()),
    ).resolves.toMatchObject({
      memberRole: DineInMemberRole.GUEST,
    });
    expect(membersRepository.createGuest).toHaveBeenCalledWith(
      SESSION_ID,
      GUEST_ID,
      expect.anything(),
    );
  });

  it('prevents a user from opening a session on another active table', async () => {
    sessionsRepository.findCurrentForUser.mockResolvedValue(
      session({ restaurantTableId: OTHER_TABLE_ID }),
    );

    await expect(
      service.startSession(customer(), startDto()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    () => customer({ isActive: false }),
    () => customer({ role: UserRole.RESTAURANT_OWNER }),
  ])('rejects inactive and non-customer users', async (createUser) => {
    const user = createUser();
    await expect(service.scan(user, qrDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('requires QR revalidation before joining an existing session', async () => {
    const response = await service.joinSession(
      customer({ id: GUEST_ID, firebaseUid: 'firebase-guest' }),
      SESSION_ID,
      qrDto(),
    );

    expect(response).toMatchObject({ id: SESSION_ID });
    expect(tablesRepository.lockById).toHaveBeenCalledWith(
      TABLE_ID,
      expect.anything(),
    );
  });

  it('keeps a table session open when a customer leaves', async () => {
    membersRepository.findActiveMembership.mockResolvedValue(membership());

    await expect(
      service.leaveSession(customer(), SESSION_ID),
    ).resolves.toBeUndefined();
    expect(membersRepository.deactivate).toHaveBeenCalled();
    expect(sessionsRepository.save).not.toHaveBeenCalled();
  });

  it('scopes menu search, veg filtering, and pagination to the session restaurant', async () => {
    membersRepository.findActiveMembership.mockResolvedValue(membership());
    const query = Object.assign(new DineInMenuQueryDto(), {
      page: 2,
      limit: 2,
      search: ' paneer ',
      isVeg: true,
    });
    foodsRepository.findByRestaurantId.mockResolvedValue({
      items: [food({ name: 'Paneer Tikka' })],
      total: 3,
    });

    await expect(
      service.getSessionMenu(customer(), SESSION_ID, query),
    ).resolves.toMatchObject({
      restaurantId: RESTAURANT_ID,
      page: 2,
      total: 3,
      totalPages: 2,
      items: [{ name: 'Paneer Tikka', isAvailable: true }],
    });
    expect(foodsRepository.findByRestaurantId).toHaveBeenCalledWith(
      RESTAURANT_ID,
      expect.objectContaining({
        search: ' paneer ',
        isVeg: true,
        isAvailable: true,
      }),
    );
  });

  it('allows an owner to create a table while never returning its token hash', async () => {
    const response = await service.createManagedTable(
      owner(),
      RESTAURANT_ID,
      createTableDto(),
    );

    expect(response.table).toMatchObject({ tableNumber: 'T02', capacity: 6 });
    expect(response.qrToken).toEqual(expect.any(String));
    expect(response.deepLink).toContain('foodapp://dine-in?');
    expect(JSON.stringify(response)).not.toContain('qrTokenHash');
    expect(tablesRepository.create).toHaveBeenCalledTimes(1);
  });

  it('prevents customers and other owners from managing restaurant tables', async () => {
    await expect(
      service.createManagedTable(customer(), RESTAURANT_ID, createTableDto()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      service.createManagedTable(
        owner({ id: GUEST_ID }),
        RESTAURANT_ID,
        createTableDto(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('invalidates the previous QR token when an owner regenerates it', async () => {
    const persistedTable = table({}, qrService);
    tablesRepository.findById.mockResolvedValue(persistedTable);
    const originalHash = persistedTable.qrTokenHash;

    const replacement = await service.regenerateManagedTableQr(
      owner(),
      RESTAURANT_ID,
      TABLE_ID,
    );

    expect(persistedTable.qrTokenVersion).toBe(2);
    expect(persistedTable.qrTokenHash).not.toBe(originalHash);
    await expect(service.scan(customer(), qrDto())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.scan(
        customer(),
        qrDto({ token: replacement.qrToken, version: 2 }),
      ),
    ).resolves.toMatchObject({ valid: true });
  });
});

const CUSTOMER_ID = '10000000-0000-4000-8000-000000000001';
const GUEST_ID = '10000000-0000-4000-8000-000000000002';
const OWNER_ID = '10000000-0000-4000-8000-000000000003';
const RESTAURANT_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_RESTAURANT_ID = '20000000-0000-4000-8000-000000000002';
const TABLE_ID = '30000000-0000-4000-8000-000000000001';
const OTHER_TABLE_ID = '30000000-0000-4000-8000-000000000002';
const SESSION_ID = '40000000-0000-4000-8000-000000000001';
const RAW_TOKEN = 'dine-in-qr-token-for-tests';
const NOW = new Date('2026-07-18T00:00:00.000Z');

function qrDto(
  overrides: Partial<ValidateDineInQrDto> = {},
): ValidateDineInQrDto {
  return {
    restaurantId: RESTAURANT_ID,
    tableId: TABLE_ID,
    token: RAW_TOKEN,
    version: 1,
    ...overrides,
  };
}

function startDto(
  overrides: Partial<StartDineInSessionDto> = {},
): StartDineInSessionDto {
  return { ...qrDto(), guestCount: 2, ...overrides };
}

function createTableDto(
  overrides: Partial<CreateRestaurantTableDto> = {},
): CreateRestaurantTableDto {
  return { tableNumber: 'T02', capacity: 6, ...overrides };
}

function customer(overrides: Partial<User> = {}): User {
  return {
    id: CUSTOMER_ID,
    firebaseUid: 'firebase-customer',
    phone: '+919876543210',
    name: 'Customer',
    email: null,
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function owner(overrides: Partial<User> = {}): User {
  return customer({
    id: OWNER_ID,
    firebaseUid: 'firebase-owner',
    role: UserRole.RESTAURANT_OWNER,
    ...overrides,
  });
}

function restaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: RESTAURANT_ID,
    ownerId: OWNER_ID,
    owner: owner(),
    name: 'Good Food',
    slug: 'good-food',
    description: null,
    phone: null,
    email: null,
    logoUrl: null,
    bannerUrl: null,
    addressLine: '1 Main Street',
    locality: null,
    city: 'Bengaluru',
    state: null,
    postalCode: null,
    country: 'India',
    latitude: null,
    longitude: null,
    rating: 0,
    reviewCount: 0,
    averageDeliveryMinutes: 30,
    deliveryFeePaise: 0,
    minimumOrderPaise: 0,
    serviceRadiusKm: 5,
    isOpen: true,
    isActive: true,
    isPureVeg: false,
    status: RestaurantStatus.APPROVED,
    openingTime: null,
    closingTime: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function table(
  overrides: Partial<RestaurantTable>,
  qrService: DineInQrService,
): RestaurantTable {
  return {
    id: TABLE_ID,
    restaurantId: RESTAURANT_ID,
    tableNumber: 'T01',
    displayName: 'Table 1',
    capacity: 4,
    qrTokenHash: qrService.hashToken(RAW_TOKEN),
    qrTokenVersion: 1,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function session(overrides: Partial<DineInSession> = {}): DineInSession {
  return {
    id: SESSION_ID,
    restaurantId: RESTAURANT_ID,
    restaurantTableId: TABLE_ID,
    openedByUserId: CUSTOMER_ID,
    sessionNumber: 'DIN-20260718-ABCDEF1234567890',
    status: DineInSessionStatus.ACTIVE,
    guestCount: 2,
    currentRoundNumber: 0,
    startedAt: NOW,
    billRequestedAt: null,
    paymentCompletedAt: null,
    completedAt: null,
    cancelledAt: null,
    closedAt: null,
    cancellationReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function membership(
  overrides: Partial<DineInSessionMember> = {},
): DineInSessionMember {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    dineInSessionId: SESSION_ID,
    userId: CUSTOMER_ID,
    memberRole: DineInMemberRole.HOST,
    isActive: true,
    joinedAt: NOW,
    leftAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function category(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    restaurantId: RESTAURANT_ID,
    restaurant: restaurant(),
    name: 'Starters',
    description: null,
    imageUrl: null,
    sortOrder: 0,
    isActive: true,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function food(overrides: Partial<Food> = {}): Food {
  return {
    id: '70000000-0000-4000-8000-000000000001',
    restaurantId: RESTAURANT_ID,
    restaurant: restaurant(),
    categoryId: category().id,
    category: category(),
    name: 'Vegetable Soup',
    description: null,
    imageUrl: null,
    pricePaise: 19900,
    originalPricePaise: null,
    rating: 0,
    reviewCount: 0,
    preparationMinutes: 15,
    isVeg: true,
    isBestseller: false,
    isAvailable: true,
    isActive: true,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}
