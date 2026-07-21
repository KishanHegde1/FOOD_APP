import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../users/entities/user.entity';
import { AddressLabel } from './entities/address.entity';

describe('AddressesController', () => {
  it('returns the Flutter-compatible data envelope for an authenticated user', async () => {
    const addressesService = {
      findAll: jest.fn().mockResolvedValue([
        {
          id: '20000000-0000-4000-8000-000000000001',
          label: AddressLabel.HOME,
          recipientName: 'Customer',
          phone: '+919876543210',
          addressLine: '12 Main Road',
          locality: null,
          landmark: null,
          city: 'Bengaluru',
          state: null,
          postalCode: '560038',
          country: 'India',
          latitude: null,
          longitude: null,
          isDefault: true,
          isActive: true,
          formattedAddress: '12 Main Road, Bengaluru, 560038, India',
          createdAt: new Date('2026-07-19T00:00:00.000Z'),
          updatedAt: new Date('2026-07-19T00:00:00.000Z'),
        },
      ]),
    };
    const user = {
      id: '10000000-0000-4000-8000-000000000001',
      role: UserRole.CUSTOMER,
      isActive: true,
    } as User;
    const usersService = {
      findActiveByFirebaseUid: jest.fn().mockResolvedValue(user),
    };
    const controller = new AddressesController(
      addressesService as unknown as AddressesService,
      usersService as unknown as UsersService,
    );

    await expect(
      controller.findAll({ uid: 'firebase-customer' } as never),
    ).resolves.toMatchObject({
      data: [
        {
          id: '20000000-0000-4000-8000-000000000001',
          recipientName: 'Customer',
          addressLine: '12 Main Road',
          isDefault: true,
        },
      ],
    });
    expect(usersService.findActiveByFirebaseUid).toHaveBeenCalledWith(
      'firebase-customer',
    );
    expect(addressesService.findAll).toHaveBeenCalledWith(user);
  });
});
