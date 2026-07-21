import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  Repository,
} from 'typeorm';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { Order } from './entities/order.entity';
import { DineInInvoiceListQueryDto } from './dto/dine-in-invoice-list-query.dto';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { OrderType } from './enums/order.enums';

@Injectable()
export class DineInInvoicesRepository {
  constructor(
    @InjectRepository(DineInInvoice)
    private readonly invoices: Repository<DineInInvoice>,
    @InjectRepository(DineInSession)
    private readonly sessions: Repository<DineInSession>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly dataSource: DataSource,
  ) {}

  transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
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

  async findSessionById(id: string): Promise<DineInSession | null> {
    return (await this.sessions.findOne({ where: { id } })) ?? null;
  }

  async findInvoiceBySessionId(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<DineInInvoice | null> {
    return (
      (await this.invoiceRepository(manager).findOne({
        where: { dineInSessionId: sessionId },
      })) ?? null
    );
  }

  async findInvoiceById(id: string): Promise<DineInInvoice | null> {
    return (await this.invoices.findOne({ where: { id } })) ?? null;
  }

  async lockInvoice(
    id: string,
    manager: EntityManager,
  ): Promise<DineInInvoice | null> {
    return (
      (await this.invoiceRepository(manager)
        .createQueryBuilder('invoice')
        .where('invoice.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  async findInvoiceForCustomer(
    invoiceId: string,
    userId: string,
  ): Promise<DineInInvoice | null> {
    return (
      (await this.invoices
        .createQueryBuilder('invoice')
        .innerJoin(
          DineInSessionMember,
          'member',
          'member.dine_in_session_id = invoice.dine_in_session_id',
        )
        .where('invoice.id = :invoiceId', { invoiceId })
        .andWhere('member.user_id = :userId', { userId })
        .getOne()) ?? null
    );
  }

  async findBillableOrders(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<Order[]> {
    return this.orderRepository(manager)
      .createQueryBuilder('dineInOrder')
      .leftJoinAndSelect('dineInOrder.items', 'item')
      .where('dineInOrder.dine_in_session_id = :sessionId', { sessionId })
      .andWhere('dineInOrder.order_type = :orderType', {
        orderType: OrderType.DINE_IN,
      })
      .andWhere('dineInOrder.dine_in_status = :status', {
        status: DineInOrderStatus.SERVED,
      })
      .orderBy('dineInOrder.order_round_number', 'ASC')
      .getMany();
  }

  async countUnfinishedOrders(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<number> {
    return this.orderRepository(manager).count({
      where: {
        dineInSessionId: sessionId,
        orderType: OrderType.DINE_IN,
        dineInStatus: In([
          DineInOrderStatus.DRAFT,
          DineInOrderStatus.PENDING_APPROVAL,
          DineInOrderStatus.APPROVED,
          DineInOrderStatus.PREPARING,
          DineInOrderStatus.READY,
        ]),
      },
    });
  }

  create(
    data: DeepPartial<DineInInvoice>,
    manager: EntityManager,
  ): DineInInvoice {
    return this.invoiceRepository(manager).create(data);
  }

  save(invoice: DineInInvoice, manager: EntityManager): Promise<DineInInvoice> {
    return this.invoiceRepository(manager).save(invoice);
  }

  saveSession(
    session: DineInSession,
    manager: EntityManager,
  ): Promise<DineInSession> {
    return manager.getRepository(DineInSession).save(session);
  }

  async listForCustomer(
    userId: string,
    query: DineInInvoiceListQueryDto,
  ): Promise<{ items: DineInInvoice[]; total: number }> {
    const builder = this.invoices
      .createQueryBuilder('invoice')
      .innerJoin(
        DineInSessionMember,
        'member',
        'member.dine_in_session_id = invoice.dine_in_session_id',
      )
      .where('member.user_id = :userId', { userId });
    this.applyListFilters(builder, query);
    builder
      .orderBy('invoice.requested_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  async listForRestaurant(
    restaurantId: string,
    query: DineInInvoiceListQueryDto,
  ): Promise<{ items: DineInInvoice[]; total: number }> {
    const builder = this.invoices
      .createQueryBuilder('invoice')
      .where('invoice.restaurant_id = :restaurantId', { restaurantId });
    this.applyListFilters(builder, query);
    builder
      .orderBy(
        'invoice.requested_at',
        query.status === DineInInvoiceStatus.REQUESTED || !query.status
          ? 'ASC'
          : 'DESC',
      )
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  private applyListFilters(
    builder: ReturnType<Repository<DineInInvoice>['createQueryBuilder']>,
    query: DineInInvoiceListQueryDto,
  ): void {
    if (query.status)
      builder.andWhere('invoice.status = :status', { status: query.status });
    if (query.tableId)
      builder.andWhere('invoice.restaurant_table_id = :tableId', {
        tableId: query.tableId,
      });
    if (query.sessionId)
      builder.andWhere('invoice.dine_in_session_id = :sessionId', {
        sessionId: query.sessionId,
      });
    if (query.dateFrom)
      builder.andWhere('invoice.requested_at >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      builder.andWhere('invoice.requested_at <= :dateTo', {
        dateTo: query.dateTo,
      });
  }

  private invoiceRepository(
    manager?: EntityManager,
  ): Repository<DineInInvoice> {
    return manager ? manager.getRepository(DineInInvoice) : this.invoices;
  }

  private orderRepository(manager?: EntityManager): Repository<Order> {
    return manager ? manager.getRepository(Order) : this.orders;
  }
}
