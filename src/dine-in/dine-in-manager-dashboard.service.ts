import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { User, UserRole } from '../users/entities/user.entity';
import { DineInManagerDashboardResponseDto } from './dto/dine-in-manager-dashboard-response.dto';
import { DineInInvoiceStatus } from './enums/dine-in-invoice-status.enum';
import { DineInOrderStatus } from './enums/dine-in-order-status.enum';
import { DineInSessionStatus } from './enums/dine-in-session-status.enum';
import { OrderType, PaymentStatus } from './enums/order.enums';

type MetricsRow = Record<string, string | number | null>;

@Injectable()
export class DineInManagerDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly restaurantsService: RestaurantsService,
  ) {}

  async getDashboard(
    user: User,
    restaurantId: string,
  ): Promise<DineInManagerDashboardResponseDto> {
    const restaurant =
      await this.restaurantsService.findOneForManagement(restaurantId);
    this.ensureRestaurantManager(user, restaurant.ownerId);

    const [sessions, orders, billing, cash] = await Promise.all([
      this.dataSource.query<MetricsRow[]>(
        `SELECT
           COUNT(*) FILTER (WHERE status = $2) AS "active",
           COUNT(*) FILTER (WHERE status = $3) AS "billRequested",
           COUNT(*) FILTER (WHERE status = $4) AS "paymentPending"
         FROM dine_in_sessions
         WHERE restaurant_id = $1`,
        [
          restaurantId,
          DineInSessionStatus.ACTIVE,
          DineInSessionStatus.BILL_REQUESTED,
          DineInSessionStatus.PAYMENT_PENDING,
        ],
      ),
      this.dataSource.query<MetricsRow[]>(
        `SELECT
           COUNT(*) FILTER (WHERE dine_in_status = $3) AS "pendingApproval",
           COUNT(*) FILTER (WHERE dine_in_status = $4) AS "approved",
           COUNT(*) FILTER (WHERE dine_in_status = $5) AS "preparing",
           COUNT(*) FILTER (WHERE dine_in_status = $6) AS "ready",
           COUNT(*) FILTER (WHERE dine_in_status = $7) AS "served",
           COALESCE(SUM(CASE WHEN dine_in_status IN ($3, $4, $5, $6) THEN grand_total_paise ELSE 0 END), 0) AS "activeTotalPaise"
         FROM orders
         WHERE restaurant_id = $1 AND order_type = $2`,
        [
          restaurantId,
          OrderType.DINE_IN,
          DineInOrderStatus.PENDING_APPROVAL,
          DineInOrderStatus.APPROVED,
          DineInOrderStatus.PREPARING,
          DineInOrderStatus.READY,
          DineInOrderStatus.SERVED,
        ],
      ),
      this.dataSource.query<MetricsRow[]>(
        `SELECT
           COUNT(*) FILTER (WHERE status = $2) AS "requestedBills",
           COUNT(*) FILTER (WHERE status = $3) AS "paymentPendingBills",
           COALESCE(SUM(CASE WHEN status = $3 THEN total_paise ELSE 0 END), 0) AS "amountAwaitingPaymentPaise"
         FROM dine_in_invoices
         WHERE restaurant_id = $1`,
        [
          restaurantId,
          DineInInvoiceStatus.REQUESTED,
          DineInInvoiceStatus.PAYMENT_PENDING,
        ],
      ),
      this.dataSource.query<MetricsRow[]>(
        `SELECT
           COUNT(*) AS "awaitingConfirmationCount",
           COALESCE(SUM(amount_paise), 0) AS "awaitingConfirmationAmountPaise"
         FROM payments
         WHERE restaurant_id = $1
           AND invoice_id IS NOT NULL
           AND status = $2`,
        [restaurantId, PaymentStatus.AWAITING_CASH_CONFIRMATION],
      ),
    ]);

    return {
      restaurantId,
      generatedAt: new Date().toISOString(),
      sessions: {
        active: this.number(sessions[0]?.active),
        billRequested: this.number(sessions[0]?.billRequested),
        paymentPending: this.number(sessions[0]?.paymentPending),
      },
      orders: {
        pendingApproval: this.number(orders[0]?.pendingApproval),
        approved: this.number(orders[0]?.approved),
        preparing: this.number(orders[0]?.preparing),
        ready: this.number(orders[0]?.ready),
        served: this.number(orders[0]?.served),
        activeTotalPaise: this.number(orders[0]?.activeTotalPaise),
      },
      billing: {
        requestedBills: this.number(billing[0]?.requestedBills),
        paymentPendingBills: this.number(billing[0]?.paymentPendingBills),
        amountAwaitingPaymentPaise: this.number(
          billing[0]?.amountAwaitingPaymentPaise,
        ),
      },
      cash: {
        awaitingConfirmationCount: this.number(
          cash[0]?.awaitingConfirmationCount,
        ),
        awaitingConfirmationAmountPaise: this.number(
          cash[0]?.awaitingConfirmationAmountPaise,
        ),
      },
    };
  }

  private ensureRestaurantManager(user: User, ownerId: string): void {
    if (
      !user.isActive ||
      (user.role !== UserRole.RESTAURANT_OWNER &&
        user.role !== UserRole.ADMIN) ||
      (user.role !== UserRole.ADMIN && user.id !== ownerId)
    ) {
      throw new ForbiddenException('RESTAURANT_ACCESS_DENIED');
    }
  }

  private number(value: string | number | null | undefined): number {
    return Number(value ?? 0);
  }
}
