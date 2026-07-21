import { Module } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Food } from '../foods/entities/food.entity';
import { FoodsModule } from '../foods/foods.module';
import { MenuCategoriesModule } from '../menu-categories/menu-categories.module';
import { RestaurantsModule } from '../restaurants/restaurants.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { DineInManagementController } from './dine-in-management.controller';
import { DineInOrdersManagementController } from './dine-in-orders-management.controller';
import { DineInInvoicesManagementController } from './dine-in-invoices-management.controller';
import { DineInInvoicesController } from './dine-in-invoices.controller';
import { DineInInvoicesRepository } from './dine-in-invoices.repository';
import { DineInInvoicesService } from './dine-in-invoices.service';
import { DineInPaymentsManagementController } from './dine-in-payments-management.controller';
import { DineInPaymentsController } from './dine-in-payments.controller';
import { DineInPaymentsRepository } from './dine-in-payments.repository';
import { DineInPaymentsService } from './dine-in-payments.service';
import { DineInSessionHistoryManagementController } from './dine-in-session-history-management.controller';
import { DineInOrdersRepository } from './dine-in-orders.repository';
import { DineInOrdersService } from './dine-in-orders.service';
import { DineInOrdersController } from './dine-in-orders.controller';
import { DineInSessionMembersRepository } from './dine-in-session-members.repository';
import { DineInQrService } from './dine-in-qr.service';
import { DineInSessionsRepository } from './dine-in-sessions.repository';
import { DineInController } from './dine-in.controller';
import { DineInService } from './dine-in.service';
import { DineInSessionMember } from './entities/dine-in-session-member.entity';
import { DineInSession } from './entities/dine-in-session.entity';
import { DineInInvoice } from './entities/dine-in-invoice.entity';
import { DineInPayment } from './entities/dine-in-payment.entity';
import { KitchenTicket } from './entities/kitchen-ticket.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { Order } from './entities/order.entity';
import { RestaurantTable } from './entities/restaurant-table.entity';
import { RestaurantTablesRepository } from './restaurant-tables.repository';
import { RazorpayGatewayService } from './razorpay-gateway.service';
import { RazorpayWebhookController } from './razorpay-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantTable,
      DineInSession,
      DineInInvoice,
      DineInPayment,
      DineInSessionMember,
      KitchenTicket,
      Order,
      OrderItem,
      OrderStatusHistory,
      Food,
      User,
    ]),
    ThrottlerModule.forRoot([{ name: 'default', limit: 120, ttl: 60_000 }]),
    AuthModule,
    UsersModule,
    RestaurantsModule,
    FoodsModule,
    MenuCategoriesModule,
  ],
  controllers: [
    DineInController,
    DineInManagementController,
    DineInOrdersController,
    DineInOrdersManagementController,
    DineInSessionHistoryManagementController,
    DineInInvoicesController,
    DineInInvoicesManagementController,
    DineInPaymentsController,
    DineInPaymentsManagementController,
    RazorpayWebhookController,
  ],
  providers: [
    RestaurantTablesRepository,
    DineInSessionsRepository,
    DineInSessionMembersRepository,
    DineInQrService,
    DineInService,
    DineInOrdersRepository,
    DineInOrdersService,
    DineInInvoicesRepository,
    DineInInvoicesService,
    DineInPaymentsRepository,
    DineInPaymentsService,
    RazorpayGatewayService,
    ThrottlerGuard,
  ],
})
export class DineInModule {}
