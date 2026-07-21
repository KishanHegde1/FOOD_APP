import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User, UserRole } from './entities/user.entity';
import { ProfilePhotoStorageService } from './profile-photo-storage.service';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: {
    findByFirebaseUid: jest.Mock;
    findByPhone: jest.Mock;
    findByEmail: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let profilePhotoStorage: {
    saveProfilePhoto: jest.Mock;
    deleteProfilePhoto: jest.Mock;
  };

  const identity = {
    firebaseUid: 'firebase-uid',
    phone: '+91 98765 43210',
    name: 'Firebase Customer',
    email: 'customer@example.com',
    profileImage: 'https://example.com/profile.jpg',
    emailVerified: true,
  };

  beforeEach(() => {
    repository = {
      findByFirebaseUid: jest.fn(),
      findByPhone: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn((data: Partial<User>) => createUser(data)),
      save: jest.fn((user: User) => user),
    };
    profilePhotoStorage = {
      saveProfilePhoto: jest.fn(),
      deleteProfilePhoto: jest.fn(),
    };
    service = new UsersService(
      repository as unknown as UsersRepository,
      profilePhotoStorage as unknown as ProfilePhotoStorageService,
    );
  });

  it('creates a new active CUSTOMER user from a verified Firebase identity', async () => {
    repository.findByFirebaseUid.mockResolvedValue(null);
    repository.findByPhone.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);

    const user = await service.findOrCreateByFirebaseIdentity(identity);

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        firebaseUid: 'firebase-uid',
        phone: '+919876543210',
        role: UserRole.CUSTOMER,
        isActive: true,
        phoneVerified: true,
      }),
    );
    expect(user).toMatchObject({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      name: 'Firebase Customer',
      email: 'customer@example.com',
      phoneVerified: true,
      emailVerified: true,
      role: UserRole.CUSTOMER,
    });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('reuses an existing user found by Firebase UID without creating a duplicate', async () => {
    const existingUser = createUser({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      name: 'Existing Customer',
      email: 'existing@example.com',
    });
    repository.findByFirebaseUid.mockResolvedValue(existingUser);

    const user = await service.findOrCreateByFirebaseIdentity(identity);

    expect(user).toBe(existingUser);
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.save).toHaveBeenCalledWith(existingUser);
  });

  it('attaches a Firebase UID to an existing matching phone user', async () => {
    const existingUser = createUser({
      firebaseUid: null,
      phone: '+919876543210',
    });
    repository.findByFirebaseUid.mockResolvedValue(null);
    repository.findByPhone.mockResolvedValue(existingUser);
    repository.findByEmail.mockResolvedValue(null);

    const user = await service.findOrCreateByFirebaseIdentity(identity);

    expect(repository.create).not.toHaveBeenCalled();
    expect(user.firebaseUid).toBe('firebase-uid');
    expect(user.phoneVerified).toBe(true);
  });

  it('rejects inactive users before saving them', async () => {
    repository.findByFirebaseUid.mockResolvedValue(
      createUser({
        firebaseUid: 'firebase-uid',
        phone: '+919876543210',
        isActive: false,
      }),
    );

    await expect(
      service.findOrCreateByFirebaseIdentity(identity),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('updates the last login timestamp for repeat Firebase logins', async () => {
    const existingUser = createUser({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      lastLoginAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    repository.findByFirebaseUid.mockResolvedValue(existingUser);
    const previousLogin = existingUser.lastLoginAt;

    await service.findOrCreateByFirebaseIdentity(identity);

    expect(existingUser.lastLoginAt).toBeInstanceOf(Date);
    expect(existingUser.lastLoginAt?.getTime()).toBeGreaterThan(
      previousLogin!.getTime(),
    );
  });

  it('returns an active user by Firebase UID', async () => {
    const existingUser = createUser({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
    });
    repository.findByFirebaseUid.mockResolvedValue(existingUser);

    await expect(service.findActiveByFirebaseUid('firebase-uid')).resolves.toBe(
      existingUser,
    );
  });

  it('updates only editable profile fields', async () => {
    const user = createUser({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      role: UserRole.CUSTOMER,
      isActive: true,
      phoneVerified: true,
      emailVerified: true,
    });
    repository.findByPhone.mockResolvedValue(null);
    repository.findByEmail.mockResolvedValue(null);

    await service.updateCurrentProfile(user, {
      name: '  Updated User  ',
      email: 'USER@EXAMPLE.COM',
      phone: '+918888888888',
      role: UserRole.ADMIN,
      isActive: false,
      firebaseUid: 'attacker',
    } as UpdateProfileDto & {
      role: UserRole;
      isActive: boolean;
      firebaseUid: string;
    });

    expect(repository.save).toHaveBeenCalledWith(user);
    expect(user).toMatchObject({
      firebaseUid: 'firebase-uid',
      name: 'Updated User',
      email: 'user@example.com',
      phone: '+918888888888',
      role: UserRole.CUSTOMER,
      isActive: true,
      phoneVerified: false,
      emailVerified: false,
    });
  });

  it('rejects updating a profile email already used by another user', async () => {
    const user = createUser({ id: 'user-1', email: 'old@example.com' });
    repository.findByEmail.mockResolvedValue(
      createUser({ id: 'user-2', email: 'new@example.com' }),
    );

    await expect(
      service.updateCurrentProfile(user, { email: 'new@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('replaces a profile photo and deletes the old local photo safely', async () => {
    const user = createUser({
      profileImage: '/uploads/profile-photos/old.jpg',
    });
    profilePhotoStorage.saveProfilePhoto.mockResolvedValue(
      '/uploads/profile-photos/new.jpg',
    );

    await service.updateCurrentProfilePhoto(user, {
      buffer: Buffer.from('photo'),
      mimetype: 'image/jpeg',
      originalname: 'photo.jpg',
      size: 5,
    });

    expect(user.profileImage).toBe('/uploads/profile-photos/new.jpg');
    expect(repository.save).toHaveBeenCalledWith(user);
    expect(profilePhotoStorage.deleteProfilePhoto).toHaveBeenCalledWith(
      '/uploads/profile-photos/old.jpg',
    );
  });

  it('removes a profile photo and returns success when no photo exists', async () => {
    const user = createUser({ profileImage: null });

    await expect(service.removeCurrentProfilePhoto(user)).resolves.toBe(user);

    expect(repository.save).not.toHaveBeenCalled();
    expect(profilePhotoStorage.deleteProfilePhoto).not.toHaveBeenCalled();
  });
});

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: '3d1f4e4d-b039-49a6-bcc8-0d3cf466dc15',
    firebaseUid: null,
    phone: null,
    name: null,
    email: null,
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: false,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}
