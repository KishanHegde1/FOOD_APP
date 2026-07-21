import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PaymentMethod } from '../../dine-in/enums/order.enums';
import { CreateRazorpayOrderDto } from './create-razorpay-order.dto';

describe('CreateRazorpayOrderDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });

  it('accepts UPI and deliveryAddressId', async () => {
    await expect(
      pipe.transform(
        {
          deliveryAddressId: '10000000-0000-4000-8000-000000000001',
          method: PaymentMethod.UPI,
        },
        { type: 'body', metatype: CreateRazorpayOrderDto },
      ),
    ).resolves.toEqual({
      deliveryAddressId: '10000000-0000-4000-8000-000000000001',
      method: PaymentMethod.UPI,
    });
  });

  it('rejects non-online payment methods before service execution', async () => {
    await expect(
      pipe.transform(
        {
          deliveryAddressId: '10000000-0000-4000-8000-000000000001',
          method: PaymentMethod.CASH_ON_DELIVERY,
        },
        { type: 'body', metatype: CreateRazorpayOrderDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
