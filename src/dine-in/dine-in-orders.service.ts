import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Food } from '../foods/entities/food.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CreateDineInOrderDto } from './dto/create-dine-in-order.dto';
import {
  DineInOrderResponseDto,
  PaginatedDineInOrdersResponseDto,
} from './dto/dine-in-order-response.dto';
import { ManagerDineInOrderListQueryDto } from './dto/manager-dine-in-order-list-query.dto';
import { RejectDineInOrderDto } from './dto/reject-dine-in-order.dto';
import {
  DineInKitchenStatusUpdate,
  UpdateDineInKitchenStatusDto,
} from './dto/update-dine-in-kitchen-status.dto';
import { DineInSessionOrdersQueryDto } from './dto/dine-in-session-orders-query.dto';
import { DineInSessionOrderSummaryDto } from './dto/dine-in-session-order-summary.dto';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { DineInOrdersRepository } from './dine-in-orders.repository';
import { DineInSession } from './entities/dine-in-session.entity';
import { Order } from './entities/order.entity';
import { RestaurantTablesRepository } from './restaurant-tables.repository';
import { DineInMenuAvailabilityService } from './dine-in-menu-availability.service';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import {
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from './enums/order.enums';
import { EntityManager } from 'typeorm';

@Injectable()
export class DineInOrdersService {
  constructor(
    private readonly ordersRepository: DineInOrdersRepository,
    private readonly membersRepository: DineInSessionMembersRepository,
    private readonly tablesRepository: RestaurantTablesRepository,
    private readonly restaurantsService: RestaurantsService,
    private readonly menuAvailability: DineInMenuAvailabilityService,
  ) {}

  async create(
    user: User,
    sessionId: string,
    dto: CreateDineInOrderDto,
  ): Promise<DineInOrderResponseDto> {
    this.ensureCustomer(user);
    const orderNumber = this.idempotencyOrderNumber(
      user.id,
      sessionId,
      dto.idempotencyKey,
    );
    return this.ordersRepository.transaction(async (manager) => {
      const session = await this.requireLockedActiveSession(sessionId, manager);
      await this.requireActiveMember(session.id, user.id, manager);
      const existing = await this.ordersRepository.findDetailedByOrderNumber(
        orderNumber,
        manager,
      );
      if (existing) return DineInOrderResponseDto.fromEntity(existing);
      const table = await this.tablesRepository.findActiveByIdAndRestaurant(
        session.restaurantTableId,
        session.restaurantId,
        manager,
      );
      if (!table) throw new BadRequestException('TABLE_RESTAURANT_MISMATCH');
      const foods = await this.ordersRepository.findFoodsByIds(
        dto.items.map((item) => item.foodItemId),
        manager,
      );
      const foodById = new Map(foods.map((food) => [food.id, food]));
      const snapshots = dto.items.map((item) =>
        this.toItemSnapshot(
          item,
          foodById.get(item.foodItemId),
          session.restaurantId,
        ),
      );
      const subtotal = snapshots.reduce(
        (sum, item) => sum + item.subtotalPaise,
        0,
      );
      session.currentRoundNumber += 1;
      await this.ordersRepository.saveSession(session, manager);
      const order = await this.ordersRepository.saveOrder(
        this.ordersRepository.createOrder(
          {
            orderNumber,
            customerId: user.id,
            restaurantId: session.restaurantId,
            deliveryPartnerId: null,
            deliveryAddressId: null,
            recipientNameSnapshot: user.name?.trim() || 'Dine-in guest',
            recipientPhoneSnapshot: user.phone,
            deliveryAddressSnapshot: `Dine-in table ${table.tableNumber}`,
            deliveryLatitude: null,
            deliveryLongitude: null,
            itemTotalPaise: subtotal,
            deliveryFeePaise: 0,
            platformFeePaise: 0,
            taxPaise: 0,
            discountPaise: 0,
            grandTotalPaise: subtotal,
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
            paymentStatus: PaymentStatus.PENDING,
            orderStatus: OrderStatus.PLACED,
            couponCode: null,
            deliveryInstructions: null,
            cancellationReason: null,
            estimatedDeliveryAt: null,
            acceptedAt: null,
            preparedAt: null,
            pickedUpAt: null,
            deliveredAt: null,
            cancelledAt: null,
            orderType: OrderType.DINE_IN,
            dineInSessionId: session.id,
            restaurantTableId: table.id,
            orderRoundNumber: session.currentRoundNumber,
            dineInStatus: DineInOrderStatus.PENDING_APPROVAL,
            approvedAt: null,
            rejectedAt: null,
            preparationStartedAt: null,
            readyAt: null,
            servedAt: null,
            rejectionReason: null,
          },
          manager,
        ),
        manager,
      );
      order.items = await this.ordersRepository.saveItems(
        this.ordersRepository.createItems(
          snapshots.map((item) => ({ ...item, orderId: order.id })),
          manager,
        ),
        manager,
      );
      order.dineInSession = session;
      order.restaurantTable = table;
      await this.addHistory(
        order.id,
        null,
        OrderStatus.PLACED,
        user.id,
        'DINE_IN_STATUS:PENDING_APPROVAL',
        manager,
      );
      return DineInOrderResponseDto.fromEntity(order);
    });
  }

  async listForSession(
    user: User,
    sessionId: string,
    query: DineInSessionOrdersQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    this.ensureCustomer(user);
    await this.requireSessionMember(sessionId, user.id);
    const result = await this.ordersRepository.listForSession(sessionId, query);
    return this.paginated(result, query);
  }
  async listActiveForSession(
    user: User,
    sessionId: string,
  ): Promise<DineInOrderResponseDto[]> {
    this.ensureCustomer(user);
    await this.requireSessionMember(sessionId, user.id);
    const result = await this.ordersRepository.listForSession(
      sessionId,
      Object.assign(new DineInSessionOrdersQueryDto(), {
        includeItems: false,
        limit: 100,
      }),
      true,
    );
    return result.items.map((order) =>
      DineInOrderResponseDto.fromEntity(order),
    );
  }
  async getSessionSummary(
    user: User,
    sessionId: string,
  ): Promise<DineInSessionOrderSummaryDto> {
    this.ensureCustomer(user);
    const session = await this.requireSessionMember(sessionId, user.id);
    return this.summaryForSession(session);
  }
  async getForCustomer(
    user: User,
    orderId: string,
  ): Promise<DineInOrderResponseDto> {
    this.ensureCustomer(user);
    const order = await this.requireDineInOrder(orderId);
    await this.requireSessionMember(order.dineInSessionId ?? '', user.id);
    return DineInOrderResponseDto.fromEntity(order);
  }
  async getForCustomerSession(
    user: User,
    sessionId: string,
    orderId: string,
  ): Promise<DineInOrderResponseDto> {
    this.ensureCustomer(user);
    await this.requireSessionMember(sessionId, user.id);
    const order = await this.ordersRepository.findDetailedBySessionAndId(
      sessionId,
      orderId,
    );
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    return DineInOrderResponseDto.fromEntity(order);
  }
  async cancel(user: User, orderId: string): Promise<DineInOrderResponseDto> {
    this.ensureCustomer(user);
    return this.ordersRepository.transaction(async (manager) => {
      const order = await this.requireLockedDineInOrder(orderId, manager);
      await this.requireLockedActiveSession(
        order.dineInSessionId ?? '',
        manager,
      );
      await this.requireActiveMember(
        order.dineInSessionId ?? '',
        user.id,
        manager,
      );
      if (order.customerId !== user.id)
        throw new ForbiddenException('ORDER_ACCESS_DENIED');
      if (order.dineInStatus !== DineInOrderStatus.PENDING_APPROVAL)
        throw new ConflictException('ORDER_NOT_PENDING_APPROVAL');
      order.dineInStatus = DineInOrderStatus.CANCELLED;
      order.orderStatus = OrderStatus.CANCELLED;
      order.cancelledAt = new Date();
      const saved = await this.ordersRepository.saveOrder(order, manager);
      await this.addHistory(
        saved.id,
        OrderStatus.PLACED,
        OrderStatus.CANCELLED,
        user.id,
        'DINE_IN_STATUS:CANCELLED',
        manager,
      );
      return DineInOrderResponseDto.fromEntity(saved);
    });
  }
  async listForManager(
    user: User,
    restaurantId: string,
    query: ManagerDineInOrderListQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const result = await this.ordersRepository.listForRestaurant(
      restaurantId,
      query,
    );
    return {
      items: result.items.map((order) =>
        DineInOrderResponseDto.fromEntity(order),
      ),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }
  async getForManager(
    user: User,
    restaurantId: string,
    orderId: string,
  ): Promise<DineInOrderResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const order = await this.requireDineInOrder(orderId);
    this.requireOrderRestaurant(order, restaurantId);
    return DineInOrderResponseDto.fromEntity(order);
  }
  async listForManagerSession(
    user: User,
    restaurantId: string,
    sessionId: string,
    query: DineInSessionOrdersQueryDto,
  ): Promise<PaginatedDineInOrdersResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const session = await this.requireSession(sessionId);
    if (session.restaurantId !== restaurantId)
      throw new NotFoundException('SESSION_NOT_FOUND');
    return this.paginated(
      await this.ordersRepository.listForSession(sessionId, query),
      query,
    );
  }
  async getManagerSessionSummary(
    user: User,
    restaurantId: string,
    sessionId: string,
  ): Promise<DineInSessionOrderSummaryDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const session = await this.requireSession(sessionId);
    if (session.restaurantId !== restaurantId)
      throw new NotFoundException('SESSION_NOT_FOUND');
    return this.summaryForSession(session);
  }
  async approve(
    user: User,
    restaurantId: string,
    orderId: string,
  ): Promise<DineInOrderResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.ordersRepository.transaction(async (manager) => {
      const order = await this.requireLockedDineInOrder(orderId, manager);
      this.requireOrderRestaurant(order, restaurantId);
      const session = await this.requireLockedActiveSession(
        order.dineInSessionId ?? '',
        manager,
      );
      if (order.dineInStatus === DineInOrderStatus.APPROVED)
        return DineInOrderResponseDto.fromEntity(order);
      if (order.dineInStatus !== DineInOrderStatus.PENDING_APPROVAL)
        throw new ConflictException('ORDER_NOT_PENDING_APPROVAL');
      const foods = await this.ordersRepository.findFoodsByIds(
        (order.items ?? []).flatMap((item) =>
          item.foodItemId ? [item.foodItemId] : [],
        ),
        manager,
      );
      for (const item of order.items ?? [])
        this.ensureFood(
          item.foodItemId
            ? foods.find((food) => food.id === item.foodItemId)
            : undefined,
          order.restaurantId,
          false,
        );
      order.dineInStatus = DineInOrderStatus.APPROVED;
      order.orderStatus = OrderStatus.ACCEPTED;
      order.approvedAt = new Date();
      order.rejectedAt = null;
      order.rejectionReason = null;
      const saved = await this.ordersRepository.saveOrder(order, manager);
      await this.addHistory(
        saved.id,
        OrderStatus.PLACED,
        OrderStatus.ACCEPTED,
        user.id,
        'DINE_IN_STATUS:APPROVED',
        manager,
      );
      if (!(await this.ordersRepository.findTicketByOrderId(saved.id, manager)))
        await this.ordersRepository.saveTicket(
          this.ordersRepository.createTicket(
            {
              restaurantId: saved.restaurantId,
              orderId: saved.id,
              dineInSessionId: session.id,
              restaurantTableId: saved.restaurantTableId ?? '',
              ticketNumber: this.ticketNumber(saved.id),
              status: DineInOrderStatus.APPROVED,
              acceptedByUserId: null,
              acceptedAt: null,
              preparationStartedAt: null,
              readyAt: null,
              servedAt: null,
            },
            manager,
          ),
          manager,
        );
      return DineInOrderResponseDto.fromEntity(saved);
    });
  }
  async reject(
    user: User,
    restaurantId: string,
    orderId: string,
    dto: RejectDineInOrderDto,
  ): Promise<DineInOrderResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.ordersRepository.transaction(async (manager) => {
      const order = await this.requireLockedDineInOrder(orderId, manager);
      this.requireOrderRestaurant(order, restaurantId);
      if (order.dineInStatus !== DineInOrderStatus.PENDING_APPROVAL)
        throw new ConflictException('ORDER_NOT_PENDING_APPROVAL');
      order.dineInStatus = DineInOrderStatus.REJECTED;
      order.orderStatus = OrderStatus.REJECTED;
      order.rejectedAt = new Date();
      order.approvedAt = null;
      order.rejectionReason = dto.reason.trim();
      const saved = await this.ordersRepository.saveOrder(order, manager);
      await this.addHistory(
        saved.id,
        OrderStatus.PLACED,
        OrderStatus.REJECTED,
        user.id,
        `DINE_IN_STATUS:REJECTED ${saved.rejectionReason}`,
        manager,
      );
      return DineInOrderResponseDto.fromEntity(saved);
    });
  }

  async updateKitchenStatus(
    user: User,
    restaurantId: string,
    orderId: string,
    dto: UpdateDineInKitchenStatusDto,
  ): Promise<DineInOrderResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.ordersRepository.transaction(async (manager) => {
      const order = await this.requireLockedDineInOrder(orderId, manager);
      this.requireOrderRestaurant(order, restaurantId);
      const targetStatus: DineInOrderStatus = {
        [DineInKitchenStatusUpdate.PREPARING]: DineInOrderStatus.PREPARING,
        [DineInKitchenStatusUpdate.READY]: DineInOrderStatus.READY,
        [DineInKitchenStatusUpdate.SERVED]: DineInOrderStatus.SERVED,
      }[dto.status];

      if (order.dineInStatus === targetStatus) {
        return DineInOrderResponseDto.fromEntity(order);
      }
      if (!this.canTransitionKitchenStatus(order.dineInStatus, targetStatus)) {
        throw new ConflictException('INVALID_KITCHEN_STATUS_TRANSITION');
      }

      const ticket = await this.ordersRepository.lockTicketByOrderId(
        order.id,
        manager,
      );
      if (!ticket) throw new NotFoundException('KITCHEN_TICKET_NOT_FOUND');

      const now = new Date();
      const previousOrderStatus = order.orderStatus;
      order.dineInStatus = targetStatus;
      ticket.status = targetStatus;

      if (targetStatus === DineInOrderStatus.PREPARING) {
        order.orderStatus = OrderStatus.PREPARING;
        order.preparationStartedAt = now;
        ticket.acceptedByUserId ??= user.id;
        ticket.acceptedAt ??= now;
        ticket.preparationStartedAt = now;
      }
      if (targetStatus === DineInOrderStatus.READY) {
        order.orderStatus = OrderStatus.READY_FOR_PICKUP;
        order.preparedAt = now;
        order.readyAt = now;
        ticket.readyAt = now;
      }
      if (targetStatus === DineInOrderStatus.SERVED) {
        order.orderStatus = OrderStatus.DELIVERED;
        order.deliveredAt = now;
        order.servedAt = now;
        ticket.servedAt = now;
      }

      const saved = await this.ordersRepository.saveOrder(order, manager);
      await this.ordersRepository.saveTicket(ticket, manager);
      await this.addHistory(
        saved.id,
        previousOrderStatus,
        saved.orderStatus,
        user.id,
        `DINE_IN_STATUS:${targetStatus}`,
        manager,
      );
      return DineInOrderResponseDto.fromEntity(saved);
    });
  }
  private async requireDineInOrder(id: string): Promise<Order> {
    const order = await this.ordersRepository.findDetailedById(id);
    if (!order || order.orderType !== OrderType.DINE_IN)
      throw new NotFoundException('ORDER_NOT_FOUND');
    return order;
  }
  private async requireLockedDineInOrder(
    id: string,
    manager: EntityManager,
  ): Promise<Order> {
    const order = await this.ordersRepository.lockOrder(id, manager);
    if (!order || order.orderType !== OrderType.DINE_IN)
      throw new NotFoundException('ORDER_NOT_FOUND');
    return order;
  }
  private async requireActiveSession(id: string): Promise<DineInSession> {
    const session = await this.requireSession(id);
    if (session.status !== DineInSessionStatus.ACTIVE)
      throw new ConflictException('SESSION_NOT_ACTIVE');
    return session;
  }
  private async requireSession(id: string): Promise<DineInSession> {
    const session = await this.ordersRepository.findSessionById(id);
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    return session;
  }
  private async requireLockedActiveSession(
    id: string,
    manager: EntityManager,
  ): Promise<DineInSession> {
    const session = await this.ordersRepository.lockSession(id, manager);
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    if (session.status !== DineInSessionStatus.ACTIVE)
      throw new ConflictException('SESSION_NOT_ACTIVE');
    return session;
  }
  private async requireActiveMember(
    sessionId: string,
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (
      !(await this.membersRepository.findActiveMembership(
        sessionId,
        userId,
        manager,
      ))
    )
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
  }
  private async requireSessionMember(
    sessionId: string,
    userId: string,
  ): Promise<DineInSession> {
    const session = await this.requireSession(sessionId);
    if (!(await this.membersRepository.findMembership(sessionId, userId)))
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
    return session;
  }
  private toItemSnapshot(
    item: CreateDineInOrderDto['items'][number],
    food: Food | undefined,
    restaurantId: string,
  ) {
    this.ensureFood(food, restaurantId);
    return {
      foodItemId: food.id,
      foodNameSnapshot: food.name,
      foodDescriptionSnapshot: food.description,
      foodImageSnapshot: food.imageUrl,
      unitPricePaise: food.pricePaise,
      quantity: item.quantity,
      subtotalPaise: food.pricePaise * item.quantity,
      instructions: item.specialInstructions?.trim() || null,
    };
  }
  private ensureFood(
    food: Food | undefined,
    restaurantId: string,
    requireCurrentServiceWindow = true,
  ): asserts food is Food {
    if (!food) throw new NotFoundException('FOOD_ITEM_NOT_FOUND');
    if (food.restaurantId !== restaurantId)
      throw new BadRequestException('FOOD_ITEM_RESTAURANT_MISMATCH');
    if (
      !food.isActive ||
      !food.isAvailable ||
      (requireCurrentServiceWindow &&
        !this.menuAvailability.isAvailableNow(food))
    )
      throw new ConflictException('FOOD_ITEM_UNAVAILABLE');
  }
  private ensureCustomer(user: User): void {
    if (!user.isActive || user.role !== UserRole.CUSTOMER)
      throw new ForbiddenException(
        'Only active customers can place dine-in orders.',
      );
  }
  private async requireManagedRestaurant(
    user: User,
    restaurantId: string,
  ): Promise<Restaurant> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    if (
      !user.isActive ||
      (user.role !== UserRole.RESTAURANT_OWNER &&
        user.role !== UserRole.ADMIN) ||
      (user.role !== UserRole.ADMIN && restaurant.ownerId !== user.id)
    )
      throw new ForbiddenException('RESTAURANT_ACCESS_DENIED');
    return restaurant;
  }
  private requireOrderRestaurant(order: Order, restaurantId: string): void {
    if (order.restaurantId !== restaurantId)
      throw new NotFoundException('ORDER_NOT_FOUND');
  }

  private canTransitionKitchenStatus(
    currentStatus: DineInOrderStatus | null,
    targetStatus: DineInOrderStatus,
  ): boolean {
    return (
      (currentStatus === DineInOrderStatus.APPROVED &&
        targetStatus === DineInOrderStatus.PREPARING) ||
      (currentStatus === DineInOrderStatus.PREPARING &&
        targetStatus === DineInOrderStatus.READY) ||
      (currentStatus === DineInOrderStatus.READY &&
        targetStatus === DineInOrderStatus.SERVED)
    );
  }
  private paginated(
    result: { items: Order[]; total: number },
    query: DineInSessionOrdersQueryDto,
  ): PaginatedDineInOrdersResponseDto {
    return {
      items: result.items.map((order) =>
        DineInOrderResponseDto.fromEntity(order),
      ),
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }
  private async summaryForSession(
    session: DineInSession,
  ): Promise<DineInSessionOrderSummaryDto> {
    const [restaurant, table, aggregate] = await Promise.all([
      this.restaurantsService.findOneForManagement(session.restaurantId),
      this.tablesRepository.findById(session.restaurantTableId),
      this.ordersRepository.aggregateSessionOrders(session.id),
    ]);
    if (!table || table.restaurantId !== session.restaurantId)
      throw new NotFoundException('SESSION_NOT_FOUND');
    return {
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      restaurant: { id: restaurant.id, name: restaurant.name },
      table: { id: table.id, tableNumber: table.tableNumber },
      sessionStatus: session.status,
      totalRounds: aggregate.totalRounds,
      activeOrderCount: aggregate.activeOrderCount,
      servedOrderCount: aggregate.servedOrderCount,
      rejectedOrderCount: aggregate.rejectedOrderCount,
      cancelledOrderCount: aggregate.cancelledOrderCount,
      pricing: {
        subtotalPaise: aggregate.subtotalPaise,
        taxPaise: aggregate.taxPaise,
        serviceChargePaise: aggregate.serviceChargePaise,
        discountPaise: aggregate.discountPaise,
        payableTotalPaise: aggregate.payableTotalPaise,
      },
      canAddMoreItems: session.status === DineInSessionStatus.ACTIVE,
    };
  }
  private addHistory(
    orderId: string,
    previousStatus: OrderStatus | null,
    newStatus: OrderStatus,
    userId: string,
    note: string,
    manager: EntityManager,
  ): Promise<unknown> {
    return this.ordersRepository.saveHistory(
      this.ordersRepository.createHistory(
        { orderId, previousStatus, newStatus, changedByUserId: userId, note },
        manager,
      ),
      manager,
    );
  }
  private idempotencyOrderNumber(
    userId: string,
    sessionId: string,
    key: string,
  ): string {
    return `DIN-ORD-${createHash('sha256').update(`${userId}:${sessionId}:${key.trim()}`).digest('hex').slice(0, 24).toUpperCase()}`;
  }
  private ticketNumber(orderId: string): string {
    return `KIT-${createHash('sha256').update(orderId).digest('hex').slice(0, 20).toUpperCase()}`;
  }
}
