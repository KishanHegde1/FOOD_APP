import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CheckoutPreviewDto } from './checkout-preview.dto';

const DELIVERY_ADDRESS_ID = '20000000-0000-4000-8000-000000000001';

describe('CheckoutPreviewDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata = {
    metatype: CheckoutPreviewDto,
    type: 'body' as const,
    data: '',
  };

  it('accepts the deliveryAddressId sent by the Flutter checkout client', async () => {
    await expect(
      pipe.transform({ deliveryAddressId: DELIVERY_ADDRESS_ID }, metadata),
    ).resolves.toEqual(
      expect.objectContaining({ deliveryAddressId: DELIVERY_ADDRESS_ID }),
    );
  });

  it('rejects the obsolete addressId request field', async () => {
    await expect(
      pipe.transform({ addressId: DELIVERY_ADDRESS_ID }, metadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
