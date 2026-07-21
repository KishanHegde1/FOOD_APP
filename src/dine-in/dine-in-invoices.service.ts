import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Restaurant } from '../restaurants/entities/restaurant.entity';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { CancelDineInBillRequestDto } from './dto/cancel-dine-in-bill-request.dto';
import { DineInInvoiceListQueryDto } from './dto/dine-in-invoice-list-query.dto';
import {
  DineInInvoiceResponseDto,
  PaginatedDineInInvoicesResponseDto,
} from './dto/dine-in-invoice-response.dto';
import { DineInInvoicesRepository } from './dine-in-invoices.repository';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import {
  DineInBillingSnapshot,
  DineInInvoice,
} from './entities/dine-in-invoice.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { Order } from './entities/order.entity';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { RestaurantTablesRepository } from './restaurant-tables.repository';

@Injectable()
export class DineInInvoicesService {
  constructor(
    private readonly invoicesRepository: DineInInvoicesRepository,
    private readonly membersRepository: DineInSessionMembersRepository,
    private readonly restaurantsService: RestaurantsService,
    private readonly tablesRepository: RestaurantTablesRepository,
  ) {}

  async requestBill(
    user: User,
    sessionId: string,
  ): Promise<DineInInvoiceResponseDto> {
    this.ensureCustomer(user);
    const result = await this.invoicesRepository.transaction(
      async (manager) => {
        const session = await this.requireLockedSession(sessionId, manager);
        await this.requireActiveMember(session.id, user.id, manager);
        const existing = await this.invoicesRepository.findInvoiceBySessionId(
          session.id,
          manager,
        );
        if (session.status !== DineInSessionStatus.ACTIVE) {
          if (
            existing &&
            [
              DineInInvoiceStatus.REQUESTED,
              DineInInvoiceStatus.PAYMENT_PENDING,
              DineInInvoiceStatus.PAID,
            ].includes(existing.status)
          ) {
            return { invoice: existing, session };
          }
          throw new ConflictException('SESSION_NOT_ACTIVE');
        }
        if (
          await this.invoicesRepository.countUnfinishedOrders(
            session.id,
            manager,
          )
        )
          throw new ConflictException('UNFINISHED_ORDERS_EXIST');
        const orders = await this.invoicesRepository.findBillableOrders(
          session.id,
          manager,
        );
        if (orders.length === 0)
          throw new ConflictException('NO_PAYABLE_ORDERS');
        const snapshot = await this.buildSnapshot(session, orders);
        const now = new Date();
        let invoice: DineInInvoice;
        if (existing) {
          if (existing.status !== DineInInvoiceStatus.CANCELLED)
            throw new ConflictException('BILL_ALREADY_REQUESTED');
          invoice = existing;
          invoice.status = DineInInvoiceStatus.REQUESTED;
          invoice.customerUserId = user.id;
          invoice.subtotalPaise = this.pricing(snapshot).subtotalPaise;
          invoice.taxPaise = this.pricing(snapshot).taxPaise;
          invoice.serviceChargePaise =
            this.pricing(snapshot).serviceChargePaise;
          invoice.discountPaise = this.pricing(snapshot).discountPaise;
          invoice.totalPaise = this.pricing(snapshot).totalPaise;
          invoice.itemCount = this.itemCount(snapshot);
          invoice.orderCount = snapshot.orders.length;
          invoice.billingSnapshot = {
            ...snapshot,
            requestHistory: existing.billingSnapshot.requestHistory ?? [],
          };
          invoice.requestedAt = now;
          invoice.confirmedAt = null;
          invoice.paidAt = null;
        } else {
          invoice = this.invoicesRepository.create(
            {
              invoiceNumber: this.invoiceNumber(session.id),
              dineInSessionId: session.id,
              restaurantId: session.restaurantId,
              restaurantTableId: session.restaurantTableId,
              customerUserId: user.id,
              status: DineInInvoiceStatus.REQUESTED,
              subtotalPaise: this.pricing(snapshot).subtotalPaise,
              taxPaise: this.pricing(snapshot).taxPaise,
              serviceChargePaise: this.pricing(snapshot).serviceChargePaise,
              discountPaise: this.pricing(snapshot).discountPaise,
              totalPaise: this.pricing(snapshot).totalPaise,
              currency: 'INR',
              itemCount: this.itemCount(snapshot),
              orderCount: snapshot.orders.length,
              billingSnapshot: snapshot,
              requestedAt: now,
              confirmedAt: null,
              paidAt: null,
            },
            manager,
          );
        }
        session.status = DineInSessionStatus.BILL_REQUESTED;
        session.billRequestedAt = now;
        return {
          invoice: await this.invoicesRepository.save(invoice, manager),
          session: await this.invoicesRepository.saveSession(session, manager),
        };
      },
    );
    return this.toResponse(result.invoice, result.session);
  }

  async getBillForSession(
    user: User,
    sessionId: string,
  ): Promise<DineInInvoiceResponseDto> {
    this.ensureCustomer(user);
    const session = await this.requireCustomerSessionMember(sessionId, user.id);
    const invoice = await this.invoicesRepository.findInvoiceBySessionId(
      session.id,
    );
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return this.toResponse(invoice, session);
  }

  async getForCustomer(
    user: User,
    invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    this.ensureCustomer(user);
    const invoice = await this.invoicesRepository.findInvoiceForCustomer(
      invoiceId,
      user.id,
    );
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return this.toResponse(
      invoice,
      await this.requireSession(invoice.dineInSessionId),
    );
  }

  async listForCustomer(
    user: User,
    query: DineInInvoiceListQueryDto,
  ): Promise<PaginatedDineInInvoicesResponseDto> {
    this.ensureCustomer(user);
    const result = await this.invoicesRepository.listForCustomer(
      user.id,
      query,
    );
    return this.paginated(result, query);
  }

  async listForManager(
    user: User,
    restaurantId: string,
    query: DineInInvoiceListQueryDto,
  ): Promise<PaginatedDineInInvoicesResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    return this.paginated(
      await this.invoicesRepository.listForRestaurant(restaurantId, query),
      query,
    );
  }

  async getForManager(
    user: User,
    restaurantId: string,
    invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const invoice = await this.requireInvoice(invoiceId);
    this.requireInvoiceRestaurant(invoice, restaurantId);
    return this.toResponse(
      invoice,
      await this.requireSession(invoice.dineInSessionId),
    );
  }

  async confirm(
    user: User,
    restaurantId: string,
    invoiceId: string,
  ): Promise<DineInInvoiceResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const result = await this.invoicesRepository.transaction(
      async (manager) => {
        const invoice = await this.requireLockedInvoice(invoiceId, manager);
        this.requireInvoiceRestaurant(invoice, restaurantId);
        const session = await this.requireLockedSession(
          invoice.dineInSessionId,
          manager,
        );
        if (invoice.status === DineInInvoiceStatus.PAYMENT_PENDING)
          return { invoice, session };
        if (invoice.status !== DineInInvoiceStatus.REQUESTED)
          throw new ConflictException('INVOICE_ALREADY_CONFIRMED');
        if (session.status !== DineInSessionStatus.BILL_REQUESTED)
          throw new ConflictException('SESSION_NOT_BILL_REQUESTED');
        if (
          await this.invoicesRepository.countUnfinishedOrders(
            session.id,
            manager,
          )
        )
          throw new ConflictException('UNFINISHED_ORDERS_EXIST');
        const currentSnapshot = await this.buildSnapshot(
          session,
          await this.invoicesRepository.findBillableOrders(session.id, manager),
        );
        if (!this.matchesFrozenInvoice(invoice, currentSnapshot))
          throw new ConflictException('BILL_TOTAL_MISMATCH');
        const now = new Date();
        invoice.status = DineInInvoiceStatus.PAYMENT_PENDING;
        invoice.confirmedAt = now;
        session.status = DineInSessionStatus.PAYMENT_PENDING;
        return {
          invoice: await this.invoicesRepository.save(invoice, manager),
          session: await this.invoicesRepository.saveSession(session, manager),
        };
      },
    );
    return this.toResponse(result.invoice, result.session);
  }

  async cancelRequest(
    user: User,
    restaurantId: string,
    invoiceId: string,
    dto: CancelDineInBillRequestDto,
  ): Promise<DineInInvoiceResponseDto> {
    await this.requireManagedRestaurant(user, restaurantId);
    const result = await this.invoicesRepository.transaction(
      async (manager) => {
        const invoice = await this.requireLockedInvoice(invoiceId, manager);
        this.requireInvoiceRestaurant(invoice, restaurantId);
        const session = await this.requireLockedSession(
          invoice.dineInSessionId,
          manager,
        );
        if (invoice.status !== DineInInvoiceStatus.REQUESTED)
          throw new ConflictException('BILL_CANCELLATION_NOT_ALLOWED');
        if (session.status !== DineInSessionStatus.BILL_REQUESTED)
          throw new ConflictException('BILL_CANCELLATION_NOT_ALLOWED');
        invoice.status = DineInInvoiceStatus.CANCELLED;
        invoice.billingSnapshot = {
          ...invoice.billingSnapshot,
          requestHistory: [
            ...(invoice.billingSnapshot.requestHistory ?? []),
            {
              cancelledAt: new Date().toISOString(),
              reason: dto.reason?.trim() || null,
              snapshot: this.withoutHistory(invoice.billingSnapshot),
            },
          ],
        };
        session.status = DineInSessionStatus.ACTIVE;
        session.billRequestedAt = null;
        return {
          invoice: await this.invoicesRepository.save(invoice, manager),
          session: await this.invoicesRepository.saveSession(session, manager),
        };
      },
    );
    return this.toResponse(result.invoice, result.session);
  }

  private async buildSnapshot(
    session: DineInSession,
    orders: Order[],
  ): Promise<DineInBillingSnapshot> {
    const [restaurant, table] = await Promise.all([
      this.restaurantsService.findOneForManagement(session.restaurantId),
      this.tablesRepository.findById(session.restaurantTableId),
    ]);
    if (!table || table.restaurantId !== session.restaurantId)
      throw new NotFoundException('SESSION_NOT_FOUND');
    return {
      sessionNumber: session.sessionNumber,
      restaurantName: restaurant.name,
      tableNumber: table.tableNumber,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        roundNumber: order.orderRoundNumber ?? 0,
        status: order.dineInStatus ?? DineInOrderStatus.DRAFT,
        createdAt: order.createdAt.toISOString(),
        items: (order.items ?? []).map((item) => ({
          id: item.id,
          foodItemId: item.foodItemId,
          name: item.foodNameSnapshot,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          totalPricePaise: item.subtotalPaise,
        })),
        pricing: {
          subtotalPaise: order.itemTotalPaise,
          taxPaise: order.taxPaise,
          serviceChargePaise: order.platformFeePaise,
          discountPaise: order.discountPaise,
          totalPaise: order.grandTotalPaise,
        },
      })),
    };
  }

  private async toResponse(
    invoice: DineInInvoice,
    session: DineInSession,
  ): Promise<DineInInvoiceResponseDto> {
    const [restaurant, table] = await Promise.all([
      this.restaurantsService.findOneForManagement(invoice.restaurantId),
      this.tablesRepository.findById(invoice.restaurantTableId),
    ]);
    if (!table || table.restaurantId !== invoice.restaurantId)
      throw new NotFoundException('INVOICE_NOT_FOUND');
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      session: {
        id: session.id,
        sessionNumber: session.sessionNumber,
        status: session.status,
      },
      restaurant: { id: restaurant.id, name: restaurant.name },
      table: { id: table.id, tableNumber: table.tableNumber },
      orders: invoice.billingSnapshot.orders,
      pricing: {
        subtotalPaise: invoice.subtotalPaise,
        taxPaise: invoice.taxPaise,
        serviceChargePaise: invoice.serviceChargePaise,
        discountPaise: invoice.discountPaise,
        totalPaise: invoice.totalPaise,
        currency: invoice.currency,
      },
      itemCount: invoice.itemCount,
      orderCount: invoice.orderCount,
      requestedAt: invoice.requestedAt.toISOString(),
      confirmedAt: invoice.confirmedAt?.toISOString() ?? null,
      paidAt: invoice.paidAt?.toISOString() ?? null,
    };
  }

  private async paginated(
    result: { items: DineInInvoice[]; total: number },
    query: DineInInvoiceListQueryDto,
  ): Promise<PaginatedDineInInvoicesResponseDto> {
    const items = await Promise.all(
      result.items.map(async (invoice) =>
        this.toResponse(
          invoice,
          await this.requireSession(invoice.dineInSessionId),
        ),
      ),
    );
    return {
      items,
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    };
  }

  private pricing(snapshot: DineInBillingSnapshot) {
    return snapshot.orders.reduce(
      (totals, order) => ({
        subtotalPaise: totals.subtotalPaise + order.pricing.subtotalPaise,
        taxPaise: totals.taxPaise + order.pricing.taxPaise,
        serviceChargePaise:
          totals.serviceChargePaise + order.pricing.serviceChargePaise,
        discountPaise: totals.discountPaise + order.pricing.discountPaise,
        totalPaise: totals.totalPaise + order.pricing.totalPaise,
      }),
      {
        subtotalPaise: 0,
        taxPaise: 0,
        serviceChargePaise: 0,
        discountPaise: 0,
        totalPaise: 0,
      },
    );
  }

  private itemCount(snapshot: DineInBillingSnapshot): number {
    return snapshot.orders.reduce(
      (count, order) =>
        count +
        order.items.reduce((itemCount, item) => itemCount + item.quantity, 0),
      0,
    );
  }

  private matchesFrozenInvoice(
    invoice: DineInInvoice,
    currentSnapshot: DineInBillingSnapshot,
  ): boolean {
    const pricing = this.pricing(currentSnapshot);
    return (
      invoice.subtotalPaise === pricing.subtotalPaise &&
      invoice.taxPaise === pricing.taxPaise &&
      invoice.serviceChargePaise === pricing.serviceChargePaise &&
      invoice.discountPaise === pricing.discountPaise &&
      invoice.totalPaise === pricing.totalPaise &&
      invoice.itemCount === this.itemCount(currentSnapshot) &&
      invoice.orderCount === currentSnapshot.orders.length &&
      JSON.stringify(this.withoutHistory(invoice.billingSnapshot).orders) ===
        JSON.stringify(currentSnapshot.orders)
    );
  }

  private withoutHistory(
    snapshot: DineInBillingSnapshot,
  ): Omit<DineInBillingSnapshot, 'requestHistory'> {
    return Object.fromEntries(
      Object.entries(snapshot).filter(([key]) => key !== 'requestHistory'),
    ) as Omit<DineInBillingSnapshot, 'requestHistory'>;
  }

  private async requireCustomerSessionMember(
    sessionId: string,
    userId: string,
  ): Promise<DineInSession> {
    const session = await this.requireSession(sessionId);
    if (!(await this.membersRepository.findMembership(sessionId, userId)))
      throw new ForbiddenException('SESSION_ACCESS_DENIED');
    return session;
  }

  private async requireActiveMember(
    sessionId: string,
    userId: string,
    manager: Parameters<DineInInvoicesRepository['transaction']>[0] extends (
      manager: infer T,
    ) => Promise<unknown>
      ? T
      : never,
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

  private async requireSession(id: string): Promise<DineInSession> {
    const session = await this.invoicesRepository.findSessionById(id);
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    return session;
  }

  private async requireLockedSession(
    id: string,
    manager: Parameters<DineInInvoicesRepository['transaction']>[0] extends (
      manager: infer T,
    ) => Promise<unknown>
      ? T
      : never,
  ): Promise<DineInSession> {
    const session = await this.invoicesRepository.lockSession(id, manager);
    if (!session) throw new NotFoundException('SESSION_NOT_FOUND');
    return session;
  }

  private async requireInvoice(id: string): Promise<DineInInvoice> {
    const invoice = await this.invoicesRepository.findInvoiceById(id);
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return invoice;
  }

  private async requireLockedInvoice(
    id: string,
    manager: Parameters<DineInInvoicesRepository['transaction']>[0] extends (
      manager: infer T,
    ) => Promise<unknown>
      ? T
      : never,
  ): Promise<DineInInvoice> {
    const invoice = await this.invoicesRepository.lockInvoice(id, manager);
    if (!invoice) throw new NotFoundException('INVOICE_NOT_FOUND');
    return invoice;
  }

  private ensureCustomer(user: User): void {
    if (!user.isActive || user.role !== UserRole.CUSTOMER)
      throw new ForbiddenException('Only active customers can manage bills.');
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

  private requireInvoiceRestaurant(
    invoice: DineInInvoice,
    restaurantId: string,
  ): void {
    if (invoice.restaurantId !== restaurantId)
      throw new NotFoundException('INVOICE_NOT_FOUND');
  }

  private invoiceNumber(sessionId: string): string {
    return `DIN-INV-${sessionId.replace(/-/g, '').slice(0, 20).toUpperCase()}`;
  }
}
