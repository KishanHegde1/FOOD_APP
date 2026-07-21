import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  DeepPartial,
  EntityManager,
  In,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart } from '../cart/entities/cart.entity';
import { DineInPayment as Payment } from '../dine-in/entities/dine-in-payment.entity';
import { OrderItem } from '../dine-in/entities/order-item.entity';
import { OrderStatusHistory } from '../dine-in/entities/order-status-history.entity';
import { Order } from '../dine-in/entities/order.entity';
import {
  OrderType,
  PaymentMethod,
  PaymentStatus,
} from '../dine-in/enums/order.enums';
import { PaymentHistoryQueryDto } from './dto/payment-history-query.dto';
import { PaymentTransactionLog } from './entities/payment-transaction-log.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItems: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistory: Repository<OrderStatusHistory>,
    @InjectRepository(Cart) private readonly carts: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItems: Repository<CartItem>,
    @InjectRepository(PaymentTransactionLog)
    private readonly transactionLogs: Repository<PaymentTransactionLog>,
    @InjectRepository(PaymentWebhookEvent)
    private readonly webhookEvents: Repository<PaymentWebhookEvent>,
    private readonly dataSource: DataSource,
  ) {}

  transaction<T>(
    operation: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(operation);
  }

  async lockCartForUser(
    userId: string,
    manager: EntityManager,
  ): Promise<Cart | null> {
    return (
      (await manager
        .getRepository(Cart)
        .createQueryBuilder('cart')
        .leftJoinAndSelect('cart.restaurant', 'cartRestaurant')
        .leftJoinAndSelect('cart.items', 'cartItem')
        .leftJoinAndSelect('cartItem.food', 'food')
        .leftJoinAndSelect('food.restaurant', 'foodRestaurant')
        .where('cart.user_id = :userId', { userId })
        .orderBy('cartItem.created_at', 'ASC')
        .setLock('pessimistic_write', undefined, ['cart'])
        .getOne()) ?? null
    );
  }

  async findByUserAndIdempotency(
    userId: string,
    idempotencyKey: string,
    manager?: EntityManager,
  ): Promise<Payment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          userId,
          idempotencyKey,
          invoiceId: IsNull(),
          dineInSessionId: IsNull(),
        },
      })) ?? null
    );
  }

  async findOpenForCustomer(
    userId: string,
    manager?: EntityManager,
  ): Promise<Payment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          userId,
          invoiceId: IsNull(),
          dineInSessionId: IsNull(),
          method: In([PaymentMethod.UPI, PaymentMethod.CARD]),
          status: In([
            PaymentStatus.CREATED,
            PaymentStatus.PROCESSING,
            PaymentStatus.PENDING,
            PaymentStatus.AUTHORIZED,
          ]),
        },
        order: { createdAt: 'DESC' },
      })) ?? null
    );
  }

  async findLatestRetryableForCustomer(
    userId: string,
    manager?: EntityManager,
  ): Promise<Payment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          userId,
          invoiceId: IsNull(),
          dineInSessionId: IsNull(),
          status: In([PaymentStatus.FAILED, PaymentStatus.EXPIRED]),
        },
        order: { createdAt: 'DESC' },
      })) ?? null
    );
  }

  async findSuccessfulForOrder(
    orderId: string,
    manager?: EntityManager,
  ): Promise<Payment | null> {
    return (
      (await this.paymentRepository(manager).findOne({
        where: {
          orderId,
          invoiceId: IsNull(),
          status: In([PaymentStatus.SUCCESS, PaymentStatus.PAID]),
        },
      })) ?? null
    );
  }

  async lockPayment(
    id: string,
    manager: EntityManager,
  ): Promise<Payment | null> {
    return (
      (await this.paymentRepository(manager)
        .createQueryBuilder('payment')
        .where('payment.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  async lockOrder(id: string, manager: EntityManager): Promise<Order | null> {
    return (
      (await manager
        .getRepository(Order)
        .createQueryBuilder('order')
        .where('order.id = :id', { id })
        .setLock('pessimistic_write')
        .getOne()) ?? null
    );
  }

  async findPaymentForCustomer(
    paymentId: string,
    userId: string,
  ): Promise<Payment | null> {
    return (
      (await this.payments.findOne({
        where: {
          id: paymentId,
          userId,
          invoiceId: IsNull(),
          dineInSessionId: IsNull(),
        },
      })) ?? null
    );
  }

  async findByGatewayOrderId(gatewayOrderId: string): Promise<Payment | null> {
    return (
      (await this.payments.findOne({
        where: {
          gatewayOrderId,
          invoiceId: IsNull(),
          dineInSessionId: IsNull(),
        },
      })) ?? null
    );
  }

  async findWebhookEvent(eventId: string): Promise<PaymentWebhookEvent | null> {
    return (await this.webhookEvents.findOne({ where: { eventId } })) ?? null;
  }

  async findOrderById(orderId: string): Promise<Order | null> {
    return (
      (await this.orders.findOne({
        where: { id: orderId, orderType: OrderType.DELIVERY },
      })) ?? null
    );
  }

  createPayment(data: DeepPartial<Payment>, manager: EntityManager): Payment {
    return this.paymentRepository(manager).create(data);
  }

  createOrder(data: DeepPartial<Order>, manager: EntityManager): Order {
    return manager.getRepository(Order).create(data);
  }

  createOrderItem(
    data: DeepPartial<OrderItem>,
    manager: EntityManager,
  ): OrderItem {
    return manager.getRepository(OrderItem).create(data);
  }

  createStatusHistory(
    data: DeepPartial<OrderStatusHistory>,
    manager: EntityManager,
  ): OrderStatusHistory {
    return manager.getRepository(OrderStatusHistory).create(data);
  }

  async savePayment(
    payment: Payment,
    manager: EntityManager,
  ): Promise<Payment> {
    return this.paymentRepository(manager).save(payment);
  }

  async saveOrder(order: Order, manager: EntityManager): Promise<Order> {
    return manager.getRepository(Order).save(order);
  }

  async saveOrderItems(
    items: OrderItem[],
    manager: EntityManager,
  ): Promise<OrderItem[]> {
    return manager.getRepository(OrderItem).save(items);
  }

  async saveStatusHistory(
    history: OrderStatusHistory,
    manager: EntityManager,
  ): Promise<OrderStatusHistory> {
    return manager.getRepository(OrderStatusHistory).save(history);
  }

  async deleteCartItems(cartId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(CartItem).delete({ cartId });
  }

  async deleteCartItemsForUser(
    userId: string,
    manager: EntityManager,
  ): Promise<void> {
    const cart = await manager
      .getRepository(Cart)
      .findOne({ where: { userId } });
    if (!cart) return;
    await this.deleteCartItems(cart.id, manager);
    cart.restaurantId = null;
    cart.restaurant = null;
    cart.couponCode = null;
    await manager.getRepository(Cart).save(cart);
  }

  async updateWebhookEvent(
    id: string,
    updates: Partial<PaymentWebhookEvent>,
    manager: EntityManager,
  ): Promise<void> {
    const repository = manager.getRepository(PaymentWebhookEvent);
    const event = await repository.findOne({ where: { id } });
    if (!event) return;
    Object.assign(event, updates);
    await repository.save(event);
  }

  async saveWebhookEvent(
    event: DeepPartial<PaymentWebhookEvent>,
    manager?: EntityManager,
  ): Promise<PaymentWebhookEvent> {
    return this.webhookEventRepository(manager).save(
      this.webhookEventRepository(manager).create(event),
    );
  }

  async saveTransactionLog(
    log: DeepPartial<PaymentTransactionLog>,
    manager?: EntityManager,
  ): Promise<PaymentTransactionLog> {
    return this.transactionLogRepository(manager).save(
      this.transactionLogRepository(manager).create(log),
    );
  }

  async listForCustomer(
    userId: string,
    query: PaymentHistoryQueryDto,
  ): Promise<{ items: Payment[]; total: number }> {
    const builder = this.payments
      .createQueryBuilder('payment')
      .where('payment.user_id = :userId', { userId })
      .andWhere('payment.order_id IS NOT NULL')
      .andWhere('payment.invoice_id IS NULL')
      .andWhere('payment.dine_in_session_id IS NULL');
    this.applyFilters(builder, query);
    builder
      .orderBy('payment.initiated_at', 'DESC')
      .addOrderBy('payment.created_at', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return { items, total };
  }

  private applyFilters(
    builder: SelectQueryBuilder<Payment>,
    query: PaymentHistoryQueryDto,
  ): void {
    if (query.status) {
      builder.andWhere('payment.status = :status', { status: query.status });
    }
    if (query.method) {
      builder.andWhere('payment.method = :method', { method: query.method });
    }
    if (query.orderId) {
      builder.andWhere('payment.order_id = :orderId', {
        orderId: query.orderId,
      });
    }
  }

  private paymentRepository(manager?: EntityManager): Repository<Payment> {
    return manager ? manager.getRepository(Payment) : this.payments;
  }

  private transactionLogRepository(
    manager?: EntityManager,
  ): Repository<PaymentTransactionLog> {
    return manager
      ? manager.getRepository(PaymentTransactionLog)
      : this.transactionLogs;
  }

  private webhookEventRepository(
    manager?: EntityManager,
  ): Repository<PaymentWebhookEvent> {
    return manager
      ? manager.getRepository(PaymentWebhookEvent)
      : this.webhookEvents;
  }
}
