import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EntityManager } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { AddressesRepository } from './addresses.repository';
import { AddressesService } from './addresses.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { Address, AddressLabel } from './entities/address.entity';

describe('AddressesService', () => {
  let service: AddressesService;
  let repository: {
    countActiveByUser: jest.Mock;
    create: jest.Mock;
    findActiveByIdForUser: jest.Mock;
    findActiveByUserId: jest.Mock;
    findFirstActiveByUserId: jest.Mock;
    save: jest.Mock;
    transaction: jest.Mock;
    unsetActiveDefaultsForUser: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      countActiveByUser: jest.fn(),
      create: jest.fn((data: Partial<Address>) => address(data)),
      findActiveByIdForUser: jest.fn(),
      findActiveByUserId: jest.fn(),
      findFirstActiveByUserId: jest.fn(),
      save: jest.fn((entity: Address) => Promise.resolve(entity)),
      transaction: jest.fn(
        (
          operation: (manager: EntityManager) => Promise<unknown>,
        ): Promise<unknown> => operation({} as EntityManager),
      ),
      unsetActiveDefaultsForUser: jest.fn().mockResolvedValue(undefined),
    };
    service = new AddressesService(
      repository as unknown as AddressesRepository,
    );
  });

  it('lists only addresses returned by the active-address repository query', async () => {
    repository.findActiveByUserId.mockResolvedValue([address()]);

    await expect(service.findAll(customer())).resolves.toMatchObject([
      { id: ADDRESS_ID, isDefault: true },
    ]);
    expect(repository.findActiveByUserId).toHaveBeenCalledWith(USER_ID);
  });

  it('makes the first active address the default', async () => {
    repository.countActiveByUser.mockResolvedValue(0);

    await expect(
      service.create(customer(), createDto()),
    ).resolves.toMatchObject({
      isDefault: true,
      label: AddressLabel.HOME,
    });
    expect(repository.unsetActiveDefaultsForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        addressLine: '12 Main Road',
        isDefault: true,
      }),
      expect.anything(),
    );
  });

  it('keeps later addresses non-default unless explicitly requested', async () => {
    repository.countActiveByUser.mockResolvedValue(1);

    await expect(
      service.create(customer(), createDto()),
    ).resolves.toMatchObject({
      isDefault: false,
    });
    expect(repository.unsetActiveDefaultsForUser).not.toHaveBeenCalled();
  });

  it('creates an explicit default address and unsets the prior default', async () => {
    repository.countActiveByUser.mockResolvedValue(1);

    await expect(
      service.create(customer(), createDto({ isDefault: true })),
    ).resolves.toMatchObject({ isDefault: true, isActive: true });
    expect(repository.unsetActiveDefaultsForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it('sets a requested address as default transactionally', async () => {
    const selectedAddress = address({ isDefault: false });
    repository.findActiveByIdForUser.mockResolvedValue(selectedAddress);

    await expect(
      service.setDefault(customer(), selectedAddress.id),
    ).resolves.toMatchObject({ isDefault: true });
    expect(repository.unsetActiveDefaultsForUser).toHaveBeenCalledWith(
      USER_ID,
      expect.anything(),
    );
  });

  it('updates only an owned active address', async () => {
    const selectedAddress = address({ city: 'Delhi' });
    repository.findActiveByIdForUser.mockResolvedValue(selectedAddress);

    await expect(
      service.update(customer(), selectedAddress.id, { city: 'Mumbai' }),
    ).resolves.toMatchObject({ city: 'Mumbai' });
  });

  it('does not expose another user address', async () => {
    repository.findActiveByIdForUser.mockResolvedValue(null);

    await expect(
      service.findOne(customer(), ADDRESS_ID),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findActiveByIdForUser).toHaveBeenCalledWith(
      ADDRESS_ID,
      USER_ID,
    );
  });

  it('soft-deletes a default address and promotes an active replacement', async () => {
    const defaultAddress = address({ isDefault: true });
    const replacement = address({ id: OTHER_ADDRESS_ID, isDefault: false });
    repository.findActiveByIdForUser.mockResolvedValue(defaultAddress);
    repository.findFirstActiveByUserId.mockResolvedValue(replacement);

    await service.remove(customer(), defaultAddress.id);

    expect(defaultAddress).toMatchObject({ isActive: false, isDefault: false });
    expect(replacement.isDefault).toBe(true);
    expect(repository.save).toHaveBeenCalledWith(
      replacement,
      expect.anything(),
    );
  });

  it('rejects incomplete coordinate pairs before creating an address', async () => {
    await expect(
      service.create(customer(), createDto({ latitude: 12.9 })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.transaction).not.toHaveBeenCalled();
  });

  it.each([AddressLabel.HOME, AddressLabel.WORK, AddressLabel.OTHER])(
    'accepts the %s label and the Flutter camelCase payload',
    async (label) => {
      const dto = plainToInstance(CreateAddressDto, {
        label,
        recipientName: ' Test Customer ',
        phone: '+918618119312',
        addressLine: ' 123 Main Road ',
        locality: ' Indiranagar ',
        landmark: ' Near Metro Station ',
        city: ' Bengaluru ',
        state: ' Karnataka ',
        postalCode: '560038',
        country: 'India',
        isDefault: 'false',
      });

      await expect(validate(dto)).resolves.toHaveLength(0);
      expect(dto).toMatchObject({
        label,
        recipientName: 'Test Customer',
        addressLine: '123 Main Road',
        isDefault: false,
      });
    },
  );

  it('rejects invalid labels and missing required address fields', async () => {
    const dto = plainToInstance(CreateAddressDto, {
      label: 'Home',
      phone: '+918618119312',
      city: 'Bengaluru',
      postalCode: '560038',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['label', 'recipientName', 'addressLine']),
    );
  });

  it.each([
    ['inactive account', () => customer({ isActive: false })],
    [
      'restaurant-owner account',
      () => customer({ role: UserRole.RESTAURANT_OWNER }),
    ],
    ['administrator account', () => customer({ role: UserRole.ADMIN })],
  ])('rejects an %s before creating an address', async (_, createUser) => {
    const user = createUser();
    await expect(service.create(user, createDto())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.transaction).not.toHaveBeenCalled();
  });
});

const USER_ID = '10000000-0000-4000-8000-000000000001';
const ADDRESS_ID = '20000000-0000-4000-8000-000000000001';
const OTHER_ADDRESS_ID = '20000000-0000-4000-8000-000000000002';

function customer(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    firebaseUid: 'firebase-customer',
    phone: '+919876543210',
    name: 'Customer',
    email: null,
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}

function createDto(
  overrides: Partial<CreateAddressDto> = {},
): CreateAddressDto {
  return {
    recipientName: 'Customer',
    phone: '+919876543210',
    addressLine: '12 Main Road',
    city: 'Bengaluru',
    postalCode: '560038',
    ...overrides,
  };
}

function address(overrides: Partial<Address> = {}): Address {
  return {
    id: ADDRESS_ID,
    userId: USER_ID,
    user: customer(),
    label: AddressLabel.HOME,
    recipientName: 'Customer',
    phone: '+919876543210',
    addressLine: '12 Main Road',
    locality: 'Indiranagar',
    landmark: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560038',
    country: 'India',
    latitude: 12.97,
    longitude: 77.59,
    location: null,
    isDefault: true,
    isActive: true,
    createdAt: new Date('2026-07-18T00:00:00.000Z'),
    updatedAt: new Date('2026-07-18T00:00:00.000Z'),
    ...overrides,
  };
}
