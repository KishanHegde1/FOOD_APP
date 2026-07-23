import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin.service';
import { JwtTokenService } from '../jwt-token.service';
import { FirebaseAuthGuard } from './firebase-auth.guard';

describe('FirebaseAuthGuard', () => {
  const firebaseAdminService = {
    verifyIdToken: jest.fn(),
  };
  const jwtTokenService = {
    verifyAccessToken: jest.fn(),
  };
  let guard: FirebaseAuthGuard;

  beforeEach(() => {
    guard = new FirebaseAuthGuard(
      firebaseAdminService as unknown as FirebaseAdminService,
      jwtTokenService as unknown as JwtTokenService,
    );
    jest.clearAllMocks();
  });

  it('rejects a request without an authorization header', async () => {
    await expect(
      guard.canActivate(createContext({ headers: {} })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(firebaseAdminService.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects a malformed bearer header', async () => {
    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: 'Token abc' } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(firebaseAdminService.verifyIdToken).not.toHaveBeenCalled();
  });

  it('accepts a verified token and attaches the Firebase identity', async () => {
    jwtTokenService.verifyAccessToken.mockResolvedValue(null);
    firebaseAdminService.verifyIdToken.mockResolvedValue({
      uid: 'firebase-uid',
      phone_number: '+919876543210',
      email: 'customer@example.com',
      name: 'Customer',
      picture: 'https://example.com/profile.jpg',
      email_verified: true,
    });
    const request = { headers: { authorization: 'Bearer firebase-id-token' } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(firebaseAdminService.verifyIdToken).toHaveBeenCalledWith(
      'firebase-id-token',
    );
    expect(request).toMatchObject({
      firebaseUser: {
        uid: 'firebase-uid',
        phoneNumber: '+919876543210',
        email: 'customer@example.com',
        name: 'Customer',
        picture: 'https://example.com/profile.jpg',
        emailVerified: true,
      },
    });
  });

  it('accepts a backend JWT without re-verifying it with Firebase', async () => {
    jwtTokenService.verifyAccessToken.mockResolvedValue({
      sub: 'user-id',
      firebaseUid: 'firebase-uid',
      phoneNumber: '+919876543210',
      tokenType: 'access',
    });
    const request = { headers: { authorization: 'Bearer backend-jwt' } };

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);

    expect(firebaseAdminService.verifyIdToken).not.toHaveBeenCalled();
    expect(request).toMatchObject({
      firebaseUser: {
        uid: 'firebase-uid',
        phoneNumber: '+919876543210',
      },
    });
  });
});

function createContext(request: {
  headers: Record<string, string>;
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  } as unknown as ExecutionContext;
}
