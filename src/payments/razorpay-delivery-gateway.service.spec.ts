import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RazorpayDeliveryGatewayService } from './razorpay-delivery-gateway.service';

describe('RazorpayDeliveryGatewayService', () => {
  it('fails safely when Razorpay key ID is not configured', () => {
    const service = new RazorpayDeliveryGatewayService({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

    expect(() => service.getPublicKey()).toThrow(ServiceUnavailableException);
  });
});
