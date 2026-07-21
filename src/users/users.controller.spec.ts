import { UsersController } from './users.controller';
import { User, UserRole } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersController', () => {
  const user = createUser();
  const usersService = {
    findActiveByFirebaseUid: jest.fn(),
    updateCurrentProfile: jest.fn(),
    updateCurrentProfilePhoto: jest.fn(),
    removeCurrentProfilePhoto: jest.fn(),
  };
  let controller: UsersController;

  beforeEach(() => {
    jest.clearAllMocks();
    usersService.findActiveByFirebaseUid.mockResolvedValue(user);
    usersService.updateCurrentProfile.mockResolvedValue({
      ...user,
      name: 'Updated User',
    });
    usersService.updateCurrentProfilePhoto.mockResolvedValue({
      ...user,
      profileImage: '/uploads/profile-photos/photo.jpg',
    });
    usersService.removeCurrentProfilePhoto.mockResolvedValue({
      ...user,
      profileImage: null,
    });
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('gets the authenticated user profile', async () => {
    await expect(
      controller.getCurrentProfile({ uid: 'firebase-uid' } as never),
    ).resolves.toMatchObject({
      success: true,
      data: {
        user: {
          id: user.id,
          firebaseUid: 'firebase-uid',
          phone: '+919876543210',
          phoneNumber: '+919876543210',
          role: UserRole.CUSTOMER,
        },
      },
    });
    expect(usersService.findActiveByFirebaseUid).toHaveBeenCalledWith(
      'firebase-uid',
    );
  });

  it('updates the authenticated user profile', async () => {
    await expect(
      controller.updateCurrentProfile({ uid: 'firebase-uid' } as never, {
        name: 'Updated User',
      }),
    ).resolves.toMatchObject({
      message: 'Profile updated successfully',
      data: { user: { name: 'Updated User' } },
    });
    expect(usersService.updateCurrentProfile).toHaveBeenCalledWith(user, {
      name: 'Updated User',
    });
  });

  it('uploads the authenticated user profile photo', async () => {
    await expect(
      controller.uploadProfilePhoto({ uid: 'firebase-uid' } as never, {
        buffer: Buffer.from('photo'),
        mimetype: 'image/png',
        originalname: 'photo.png',
        size: 5,
      }),
    ).resolves.toMatchObject({
      message: 'Profile photo updated successfully',
      data: {
        user: { profileImage: '/uploads/profile-photos/photo.jpg' },
      },
    });
  });

  it('removes the authenticated user profile photo', async () => {
    await expect(
      controller.removeProfilePhoto({ uid: 'firebase-uid' } as never),
    ).resolves.toMatchObject({
      message: 'Profile photo removed successfully',
      data: { user: { profileImage: null } },
    });
  });
});

function createUser(): User {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    firebaseUid: 'firebase-uid',
    phone: '+919876543210',
    name: 'Customer',
    email: 'customer@example.com',
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: true,
    emailVerified: true,
    lastLoginAt: null,
    createdAt: new Date('2026-07-20T00:00:00.000Z'),
    updatedAt: new Date('2026-07-20T00:00:00.000Z'),
  };
}
