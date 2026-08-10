import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  Repository,
} from 'typeorm';
import { Food } from '../foods/entities/food.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { OrderType } from './enums/order.enums';
import { ManagerDineInOrderListQueryDto } from './dto/manager-dine-in-order-list-query.dto';
import { DineInSessionOrdersQueryDto } from './dto/dine-in-session-orders-query.dto';

export type DineInSessionOrderAggregate = {
  totalRounds: number;
  activeOrderCount: number;
  servedOrderCount: number;
  rejectedOrderCount: number;
  cancelledOrderCount: number;
  subtotalPaise: number;
  taxPaise: number;
  serviceChargePaise: number;
  discountPaise: number;
  payableTotalPaise: number;
};

@Injectable()
export class DineInOrdersRepository {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem) private readonly items: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly history: Repository<OrderStatusHistory>,
    @InjectRepository(KitchenTicket)
    private readonly tickets: Repository<KitchenTicket>,
    @InjectRepository(Food) private readonly foods: Repository<Food>,
    @InjectRepository(DineInSession)
    private readonly sessions: Repository<DineInSession>,
    private readonly dataSource: DataSource,
  ) {}

  transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }
  async findSessionById(id: string): Promise<DineInSession | null> {
    return (await this.sessions.findOne({ where: { id } })) ?? null;
  }
  async lockSession(
    id: string,
    manager: EntityManager,
  ): Promise<DineInSession | null> {
    return (
      (await manager
        .getRepository(DineInSession)
        .createQueryBuilder('session')
        .where('session.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }
  async lockOrder(id: string, manager: EntityManager): Promise<Order | null> {
    return (
      (await this.orderRepo(manager)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.dineInSession', 'session')
        .leftJoinAndSelect('order.restaurantTable', 'table')
        .where('order.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }
  async findDetailedById(id: string): Promise<Order | null> {
    return (
      (await this.orders
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.dineInSession', 'session')
        .leftJoinAndSelect('order.restaurantTable', 'table')
        .where('order.id = :id', { id })
        .getOne()) ?? null
    );
  }
  async findDetailedBySessionAndId(
    sessionId: string,
    orderId: string,
  ): Promise<Order | null> {
    return (
      (await this.orders
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.dineInSession', 'session')
        .leftJoinAndSelect('order.restaurantTable', 'table')
        .where('order.id = :orderId', { orderId })
        .andWhere('order.dine_in_session_id = :sessionId', { sessionId })
        .andWhere('order.order_type = :orderType', {
          orderType: OrderType.DINE_IN,
        })
        .getOne()) ?? null
    );
  }
  async findDetailedByOrderNumber(
    orderNumber: string,
    manager?: EntityManager,
  ): Promise<Order | null> {
    return (
      (await this.orderRepo(manager)
        .createQueryBuilder('order')
        .leftJoinAndSelect('order.items', 'items')
        .leftJoinAndSelect('order.dineInSession', 'session')
        .leftJoinAndSelect('order.restaurantTable', 'table')
        .where('order.order_number = :orderNumber', { orderNumber })
        .getOne()) ?? null
    );
  }
  async findFoodsByIds(ids: string[], manager: EntityManager): Promise<Food[]> {
    return manager.getRepository(Food).find({ where: { id: In(ids) } });
  }
  createOrder(data: DeepPartial<Order>, manager: EntityManager): Order {
    return this.orderRepo(manager).create(data);
  }
  saveOrder(order: Order, manager: EntityManager): Promise<Order> {
    return this.orderRepo(manager).save(order);
  }
  saveSession(
    session: DineInSession,
    manager: EntityManager,
  ): Promise<DineInSession> {
    return manager.getRepository(DineInSession).save(session);
  }
  createItems(
    data: DeepPartial<OrderItem>[],
    manager: EntityManager,
  ): OrderItem[] {
    return manager.getRepository(OrderItem).create(data);
  }
  saveItems(items: OrderItem[], manager: EntityManager): Promise<OrderItem[]> {
    return manager.getRepository(OrderItem).save(items);
  }
  createHistory(
    data: DeepPartial<OrderStatusHistory>,
    manager: EntityManager,
  ): OrderStatusHistory {
    return manager.getRepository(OrderStatusHistory).create(data);
  }
  saveHistory(
    entry: OrderStatusHistory,
    manager: EntityManager,
  ): Promise<OrderStatusHistory> {
    return manager.getRepository(OrderStatusHistory).save(entry);
  }
  async findTicketByOrderId(
    orderId: string,
    manager?: EntityManager,
  ): Promise<KitchenTicket | null> {
    return (
      (await this.ticketRepo(manager).findOne({ where: { orderId } })) ?? null
    );
  }

  async lockTicketByOrderId(
    orderId: string,
    manager: EntityManager,
  ): Promise<KitchenTicket | null> {
    return (
      (await this.ticketRepo(manager)
        .createQueryBuilder('ticket')
        .where('ticket.order_id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }
  createTicket(
    data: DeepPartial<KitchenTicket>,
    manager: EntityManager,
  ): KitchenTicket {
    return this.ticketRepo(manager).create(data);
  }
  saveTicket(
    ticket: KitchenTicket,
    manager: EntityManager,
  ): Promise<KitchenTicket> {
    return this.ticketRepo(manager).save(ticket);
  }
  async listForRestaurant(
    restaurantId: string,
    query: ManagerDineInOrderListQueryDto,
  ): Promise<{ items: Order[]; total: number }> {
    const builder = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('order.dineInSession', 'session')
      .leftJoinAndSelect('order.restaurantTable', 'table')
      .where('order.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('order.order_type = :orderType', {
        orderType: OrderType.DINE_IN,
      });
    if (query.status)
      builder.andWhere('order.dine_in_status = :status', {
        status: query.status,
      });
    if (query.tableId)
      builder.andWhere('order.restaurant_table_id = :tableId', {
        tableId: query.tableId,
      });
    if (query.sessionId)
      builder.andWhere('order.dine_in_session_id = :sessionId', {
        sessionId: query.sessionId,
      });
    if (query.search)
      builder.andWhere(
        '(order.order_number ILIKE :search OR table.table_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    if (query.dateFrom)
      builder.andWhere('order.created_at >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      builder.andWhere('order.created_at <= :dateTo', { dateTo: query.dateTo });
    builder
      .orderBy(
        'order.created_at',
        query.status === DineInOrderStatus.PENDING_APPROVAL || !query.status
          ? 'ASC'
          : 'DESC',
      )
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }
  async listForSession(
    sessionId: string,
    query: DineInSessionOrdersQueryDto,
    activeOnly = false,
  ): Promise<{ items: Order[]; total: number }> {
    const builder = this.orders
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.dineInSession', 'session')
      .leftJoinAndSelect('order.restaurantTable', 'table')
      .where('order.dine_in_session_id = :sessionId', { sessionId })
      .andWhere('order.order_type = :orderType', {
        orderType: OrderType.DINE_IN,
      });
    if (query.includeItems) builder.leftJoinAndSelect('order.items', 'items');
    if (query.status)
      builder.andWhere('order.dine_in_status = :status', {
        status: query.status,
      });
    if (activeOnly)
      builder.andWhere('order.dine_in_status IN (:...activeStatuses)', {
        activeStatuses: [
          DineInOrderStatus.PENDING_APPROVAL,
          DineInOrderStatus.APPROVED,
          DineInOrderStatus.PREPARING,
          DineInOrderStatus.READY,
        ],
      });
    builder
      .orderBy('order.order_round_number', 'ASC')
      .addOrderBy('order.created_at', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }
  async aggregateSessionOrders(
    sessionId: string,
  ): Promise<DineInSessionOrderAggregate> {
    const payableStatuses = [
      DineInOrderStatus.APPROVED,
      DineInOrderStatus.PREPARING,
      DineInOrderStatus.READY,
      DineInOrderStatus.SERVED,
    ];
    const raw = await this.orders
      .createQueryBuilder('order')
      .select('COUNT(order.id)', 'totalRounds')
      .addSelect(
        "COUNT(CASE WHEN order.dine_in_status IN ('PENDING_APPROVAL', 'APPROVED', 'PREPARING', 'READY') THEN 1 END)",
        'activeOrderCount',
      )
      .addSelect(
        "COUNT(CASE WHEN order.dine_in_status = 'SERVED' THEN 1 END)",
        'servedOrderCount',
      )
      .addSelect(
        "COUNT(CASE WHEN order.dine_in_status = 'REJECTED' THEN 1 END)",
        'rejectedOrderCount',
      )
      .addSelect(
        "COUNT(CASE WHEN order.dine_in_status = 'CANCELLED' THEN 1 END)",
        'cancelledOrderCount',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.dine_in_status IN (:...payableStatuses) THEN order.item_total_paise ELSE 0 END), 0)',
        'subtotalPaise',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.dine_in_status IN (:...payableStatuses) THEN order.tax_paise ELSE 0 END), 0)',
        'taxPaise',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.dine_in_status IN (:...payableStatuses) THEN order.platform_fee_paise ELSE 0 END), 0)',
        'serviceChargePaise',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.dine_in_status IN (:...payableStatuses) THEN order.discount_paise ELSE 0 END), 0)',
        'discountPaise',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.dine_in_status IN (:...payableStatuses) THEN order.grand_total_paise ELSE 0 END), 0)',
        'payableTotalPaise',
      )
      .where('order.dine_in_session_id = :sessionId', { sessionId })
      .andWhere('order.order_type = :orderType', {
        orderType: OrderType.DINE_IN,
      })
      .setParameter('payableStatuses', payableStatuses)
      .getRawOne<Record<string, string>>();
    return {
      totalRounds: Number(raw?.totalRounds ?? 0),
      activeOrderCount: Number(raw?.activeOrderCount ?? 0),
      servedOrderCount: Number(raw?.servedOrderCount ?? 0),
      rejectedOrderCount: Number(raw?.rejectedOrderCount ?? 0),
      cancelledOrderCount: Number(raw?.cancelledOrderCount ?? 0),
      subtotalPaise: Number(raw?.subtotalPaise ?? 0),
      taxPaise: Number(raw?.taxPaise ?? 0),
      serviceChargePaise: Number(raw?.serviceChargePaise ?? 0),
      discountPaise: Number(raw?.discountPaise ?? 0),
      payableTotalPaise: Number(raw?.payableTotalPaise ?? 0),
    };
  }
  private orderRepo(manager?: EntityManager): Repository<Order> {
    return manager ? manager.getRepository(Order) : this.orders;
  }
  private ticketRepo(manager?: EntityManager): Repository<KitchenTicket> {
    return manager ? manager.getRepository(KitchenTicket) : this.tickets;
  }
}
