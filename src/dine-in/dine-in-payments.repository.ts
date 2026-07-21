import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { DineInPaymentListQueryDto } from './dto/dine-in-payment-list-query.dto';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInPayment } from './entities/dine-in-payment.entity';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { PaymentStatus } from './enums/order.enums';

@Injectable()
export class DineInPaymentsRepository {
  constructor(
    @InjectRepository(DineInPayment)
    private readonly payments: Repository<DineInPayment>,
    @InjectRepository(DineInInvoice)
    private readonly invoices: Repository<DineInInvoice>,
    @InjectRepository(DineInSession)
    private readonly sessions: Repository<DineInSession>,
    private readonly dataSource: DataSource,
  ) {}

  transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  async lockPayment(
    id: string,
    manager: EntityManager,
  ): Promise<DineInPayment | null> {
    return (
      (await this.paymentRepository(manager)
        .createQueryBuilder('payment')
        .where('payment.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  async lockInvoice(
    id: string,
    manager: EntityManager,
  ): Promise<DineInInvoice | null> {
    return (
      (await manager
        .getRepository(DineInInvoice)
        .createQueryBuilder('invoice')
        .where('invoice.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
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

  async findById(id: string): Promise<DineInPayment | null> {
    return (await this.payments.findOne({ where: { id } })) ?? null;
  }

  async findInvoiceById(id: string): Promise<DineInInvoice | null> {
    return (await this.invoices.findOne({ where: { id } })) ?? null;
  }

  async findForCustomer(
    paymentId: string,
    userId: string,
  ): Promise<DineInPayment | null> {
    return (
      (await this.payments
        .createQueryBuilder('payment')
        .innerJoin(
          DineInSessionMember,
          'member',
          'member.dine_in_session_id = payment.dine_in_session_id',
        )
        .where('payment.id = :paymentId', { paymentId })
        .andWhere('member.user_id = :userId', { userId })
        .andWhere('payment.invoice_id IS NOT NULL')
        .getOne()) ?? null
    );
  }

  async findLatestForInvoice(invoiceId: string): Promise<DineInPayment | null> {
    return (
      (await this.payments.findOne({
        where: { invoiceId },
        order: { createdAt: 'DESC' },
      })) ?? null
    );
  }

  async findByInvoiceAndIdempotency(
    invoiceId: string,
    idempotencyKey: string,
    manager?: EntityManager,
  ): Promise<DineInPayment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: { invoiceId, idempotencyKey },
      })) ?? null
    );
  }

  async findOpenForInvoice(
    invoiceId: string,
    manager?: EntityManager,
  ): Promise<DineInPayment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          invoiceId,
          status: In([
            PaymentStatus.CREATED,
            PaymentStatus.PENDING,
            PaymentStatus.PROCESSING,
            PaymentStatus.AUTHORIZED,
            PaymentStatus.AWAITING_CASH_CONFIRMATION,
          ]),
        },
        order: { createdAt: 'DESC' },
      })) ?? null
    );
  }

  async findSuccessfulForInvoice(
    invoiceId: string,
    manager?: EntityManager,
  ): Promise<DineInPayment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          invoiceId,
          status: In([PaymentStatus.SUCCESS, PaymentStatus.PAID]),
        },
      })) ?? null
    );
  }

  async findByGatewayOrderId(
    gatewayOrderId: string,
  ): Promise<DineInPayment | null> {
    return (await this.payments.findOne({ where: { gatewayOrderId } })) ?? null;
  }

  async findByGatewayEventId(
    gatewayEventId: string,
  ): Promise<DineInPayment | null> {
    return (await this.payments.findOne({ where: { gatewayEventId } })) ?? null;
  }

  create(
    data: DeepPartial<DineInPayment>,
    manager: EntityManager,
  ): DineInPayment {
    return this.paymentRepository(manager).create(data);
  }

  save(payment: DineInPayment, manager: EntityManager): Promise<DineInPayment> {
    return this.paymentRepository(manager).save(payment);
  }

  saveInvoice(
    invoice: DineInInvoice,
    manager: EntityManager,
  ): Promise<DineInInvoice> {
    return manager.getRepository(DineInInvoice).save(invoice);
  }

  saveSession(
    session: DineInSession,
    manager: EntityManager,
  ): Promise<DineInSession> {
    return manager.getRepository(DineInSession).save(session);
  }

  async listForCustomer(
    userId: string,
    query: DineInPaymentListQueryDto,
  ): Promise<{ items: DineInPayment[]; total: number }> {
    const builder = this.payments
      .createQueryBuilder('payment')
      .innerJoin(
        DineInSessionMember,
        'member',
        'member.dine_in_session_id = payment.dine_in_session_id',
      )
      .where('member.user_id = :userId', { userId })
      .andWhere('payment.invoice_id IS NOT NULL');
    this.applyFilters(builder, query);
    return this.paginate(builder, query);
  }

  async listForRestaurant(
    restaurantId: string,
    query: DineInPaymentListQueryDto,
    cashPendingOnly = false,
  ): Promise<{ items: DineInPayment[]; total: number }> {
    const builder = this.payments
      .createQueryBuilder('payment')
      .where('payment.restaurant_id = :restaurantId', { restaurantId })
      .andWhere('payment.invoice_id IS NOT NULL');
    this.applyFilters(builder, query);
    if (cashPendingOnly)
      builder.andWhere('payment.status = :cashPendingStatus', {
        cashPendingStatus: PaymentStatus.AWAITING_CASH_CONFIRMATION,
      });
    return this.paginate(builder, query);
  }

  private async paginate(
    builder: SelectQueryBuilder<DineInPayment>,
    query: DineInPaymentListQueryDto,
  ): Promise<{ items: DineInPayment[]; total: number }> {
    builder
      .orderBy('payment.initiated_at', 'DESC')
      .addOrderBy('payment.created_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  private applyFilters(
    builder: SelectQueryBuilder<DineInPayment>,
    query: DineInPaymentListQueryDto,
  ): void {
    if (query.status)
      builder.andWhere('payment.status = :status', { status: query.status });
    if (query.method)
      builder.andWhere('payment.method = :method', { method: query.method });
    if (query.sessionId)
      builder.andWhere('payment.dine_in_session_id = :sessionId', {
        sessionId: query.sessionId,
      });
    if (query.invoiceId)
      builder.andWhere('payment.invoice_id = :invoiceId', {
        invoiceId: query.invoiceId,
      });
    if (query.tableId)
      builder.andWhere(
        `payment.dine_in_session_id IN (
          SELECT id FROM dine_in_sessions WHERE restaurant_table_id = :tableId
        )`,
        { tableId: query.tableId },
      );
    if (query.dateFrom)
      builder.andWhere('payment.initiated_at >= :dateFrom', {
        dateFrom: query.dateFrom,
      });
    if (query.dateTo)
      builder.andWhere('payment.initiated_at <= :dateTo', {
        dateTo: query.dateTo,
      });
  }

  private paymentRepository(
    manager?: EntityManager,
  ): Repository<DineInPayment> {
    return manager ? manager.getRepository(DineInPayment) : this.payments;
  }
}
