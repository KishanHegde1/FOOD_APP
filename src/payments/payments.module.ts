import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesModule } from '../addresses/addresses.module';
import { AuthModule } from '../auth/auth.module';
import { CartItem } from '../cart/entities/cart-item.entity';
import { Cart } from '../cart/entities/cart.entity';
import { DineInPayment } from '../dine-in/entities/dine-in-payment.entity';
import { OrderItem } from '../dine-in/entities/order-item.entity';
import { OrderStatusHistory } from '../dine-in/entities/order-status-history.entity';
import { Order } from '../dine-in/entities/order.entity';
import { UsersModule } from '../users/users.module';
import { PaymentTransactionLog } from './entities/payment-transaction-log.entity';
import { PaymentWebhookEvent } from './entities/payment-webhook-event.entity';
import { CheckoutCodController } from './checkout-cod.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { RazorpayDeliveryGatewayService } from './razorpay-delivery-gateway.service';
import { RazorpayDeliveryWebhookController } from './razorpay-delivery-webhook.controller';
import { RazorpayPaymentWebhookController } from './razorpay-payment-webhook.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DineInPayment,
      Order,
      OrderItem,
      OrderStatusHistory,
      Cart,
      CartItem,
      PaymentTransactionLog,
      PaymentWebhookEvent,
    ]),
    AuthModule,
    UsersModule,
    AddressesModule,
  ],
  controllers: [
    PaymentsController,
    CheckoutCodController,
    RazorpayDeliveryWebhookController,
    RazorpayPaymentWebhookController,
  ],
  providers: [
    PaymentsRepository,
    PaymentsService,
    RazorpayDeliveryGatewayService,
  ],
  exports: [RazorpayDeliveryGatewayService],
})
export class PaymentsModule {}
