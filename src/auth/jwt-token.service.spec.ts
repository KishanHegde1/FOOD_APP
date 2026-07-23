import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '../users/entities/user.entity';
import { JwtTokenService } from './jwt-token.service';

describe('JwtTokenService', () => {
  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'jwt.secret') return 'test-jwt-secret';
      if (key === 'jwt.expiresIn') return '1h';
      return undefined;
    }),
  };
  const service = new JwtTokenService(
    new JwtService(),
    configService as unknown as ConfigService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('issues and verifies a signed backend access token', async () => {
    const issued = await service.issueAccessToken(createUser());
    const payload = await service.verifyAccessToken(issued.accessToken);

    expect(issued).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    expect(payload).toMatchObject({
      sub: '10000000-0000-4000-8000-000000000001',
      firebaseUid: 'firebase-uid',
      phoneNumber: '+919876543210',
      tokenType: 'access',
    });
  });

  it('does not accept a token signed with a different secret', async () => {
    await expect(service.verifyAccessToken('not-a-jwt')).resolves.toBeNull();
  });
});

function createUser(): User {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    firebaseUid: 'firebase-uid',
    phone: '+919876543210',
    name: null,
    email: null,
    profileImage: null,
    role: UserRole.CUSTOMER,
    isActive: true,
    phoneVerified: true,
    emailVerified: false,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
