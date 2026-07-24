import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let service: AuthService;
  const usersService = {
    findOrCreateByFirebaseIdentity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('synchronizes the verified Firebase identity and returns a safe profile', async () => {
    const user: User = {
      id: '3d1f4e4d-b039-49a6-bcc8-0d3cf466dc15',
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      name: null,
      email: null,
      profileImage: null,
      role: UserRole.CUSTOMER,
      isActive: true,
      phoneVerified: true,
      emailVerified: false,
      lastLoginAt: new Date('2026-07-16T10:00:00.000Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    usersService.findOrCreateByFirebaseIdentity.mockResolvedValue(user);

    await expect(
      service.loginWithFirebase({
        uid: 'firebase-uid',
        phoneNumber: '+919876543210',
        name: null,
        email: null,
        picture: null,
        emailVerified: false,
      }),
    ).resolves.toEqual({
      user: {
        id: user.id,
        phone: '+919876543210',
        phoneNumber: '+919876543210',
        fullName: null,
        name: null,
        email: null,
        profileImage: null,
        profilePhotoUrl: null,
        dateOfBirth: null,
        gender: null,
        isProfileComplete: false,
        role: UserRole.CUSTOMER,
        phoneVerified: true,
        isActive: true,
        lastLoginAt: '2026-07-16T10:00:00.000Z',
      },
    });

    expect(usersService.findOrCreateByFirebaseIdentity).toHaveBeenCalledWith({
      firebaseUid: 'firebase-uid',
      phone: '+919876543210',
      name: null,
      email: null,
      profileImage: null,
      emailVerified: false,
    });
  });
});
