import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import {
  validatePaymentVerification,
  validateWebhookSignature,
} from 'razorpay/dist/utils/razorpay-utils';

export type RazorpayDeliveryOrder = {
  id: string;
  amount: number;
  currency: string;
};

export type RazorpayDeliveryPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
};

@Injectable()
export class RazorpayDeliveryGatewayService {
  constructor(private readonly configService: ConfigService) {}

  getPublicKey(): string {
    return this.required('RAZORPAY_KEY_ID');
  }

  async createOrder(input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    paymentReference: string;
    orderId: string;
    userId: string;
  }): Promise<RazorpayDeliveryOrder> {
    const order = await this.client().orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: {
        payment_reference: input.paymentReference,
        delivery_order_id: input.orderId,
        user_id: input.userId,
      },
    });

    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  async fetchPayment(paymentId: string): Promise<RazorpayDeliveryPayment> {
    const payment = await this.client().payments.fetch(paymentId);
    return {
      id: payment.id,
      order_id: payment.order_id ?? null,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      captured: Boolean(payment.captured),
    };
  }

  verifyCheckoutSignature(input: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    return validatePaymentVerification(
      { order_id: input.orderId, payment_id: input.paymentId },
      input.signature,
      this.required('RAZORPAY_KEY_SECRET'),
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    return validateWebhookSignature(
      rawBody,
      signature,
      this.required('RAZORPAY_WEBHOOK_SECRET'),
    );
  }

  private client(): Razorpay {
    return new Razorpay({
      key_id: this.getPublicKey(),
      key_secret: this.required('RAZORPAY_KEY_SECRET'),
    });
  }

  private required(key: string): string {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new ServiceUnavailableException('PAYMENT_GATEWAY_NOT_CONFIGURED');
    }
    return value;
  }
}
