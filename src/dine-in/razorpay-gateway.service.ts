import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import {
  validatePaymentVerification,
  validateWebhookSignature,
} from 'razorpay/dist/utils/razorpay-utils';

export type RazorpayGatewayOrder = {
  id: string;
  amount: number;
  currency: string;
};

export type RazorpayGatewayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  captured: boolean;
};

/** Thin wrapper around the official Razorpay SDK. No payment secrets leave it. */
@Injectable()
export class RazorpayGatewayService {
  constructor(private readonly configService: ConfigService) {}

  getPublicKey(): string {
    return this.required('RAZORPAY_KEY_ID');
  }

  async createOrder(input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    paymentReference: string;
  }): Promise<RazorpayGatewayOrder> {
    const order = await this.client().orders.create({
      amount: input.amountPaise,
      currency: input.currency,
      receipt: input.receipt,
      notes: { payment_reference: input.paymentReference },
    });
    return {
      id: order.id,
      amount: Number(order.amount),
      currency: order.currency,
    };
  }

  async fetchPayment(paymentId: string): Promise<RazorpayGatewayPayment> {
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

  async fetchOrderPayments(orderId: string): Promise<RazorpayGatewayPayment[]> {
    const response = await this.client().orders.fetchPayments(orderId);
    return response.items.map((payment) => ({
      id: payment.id,
      order_id: payment.order_id ?? null,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      captured: Boolean(payment.captured),
    }));
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
    if (!value)
      throw new ServiceUnavailableException(
        'DINE_IN_PAYMENT_GATEWAY_NOT_CONFIGURED',
      );
    return value;
  }
}
