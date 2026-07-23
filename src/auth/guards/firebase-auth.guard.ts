import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { FirebaseAdminService } from '../firebase-admin.service';
import { JwtTokenService } from '../jwt-token.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { FirebaseUser } from '../interfaces/firebase-user.interface';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(
    private readonly firebaseAdminService: FirebaseAdminService,
    private readonly jwtTokenService: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const idToken = this.extractBearerToken(request.headers.authorization);
    const backendToken = await this.jwtTokenService.verifyAccessToken(idToken);
    const firebaseUser = backendToken
      ? this.toFirebaseUserFromBackendToken(backendToken)
      : this.toFirebaseUser(
          await this.firebaseAdminService.verifyIdToken(idToken),
        );

    if (!firebaseUser.phoneNumber) {
      throw new UnauthorizedException(
        'A Firebase token with a verified phone number is required.',
      );
    }

    request.firebaseUser = firebaseUser;
    return true;
  }

  private extractBearerToken(authorization: string | undefined): string {
    if (!authorization) {
      throw new UnauthorizedException('A Firebase bearer token is required.');
    }

    const match = /^Bearer ([^\s]+)$/.exec(authorization);
    if (!match) {
      throw new UnauthorizedException('Malformed Firebase bearer token.');
    }

    return match[1];
  }

  private toFirebaseUser(decodedToken: {
    uid: string;
    phone_number?: unknown;
    email?: unknown;
    name?: unknown;
    picture?: unknown;
    email_verified?: unknown;
  }): FirebaseUser {
    return {
      uid: decodedToken.uid,
      phoneNumber:
        typeof decodedToken.phone_number === 'string'
          ? decodedToken.phone_number
          : '',
      email: typeof decodedToken.email === 'string' ? decodedToken.email : null,
      name: typeof decodedToken.name === 'string' ? decodedToken.name : null,
      picture:
        typeof decodedToken.picture === 'string' ? decodedToken.picture : null,
      emailVerified: decodedToken.email_verified === true,
    };
  }

  private toFirebaseUserFromBackendToken(token: {
    firebaseUid: string;
    phoneNumber: string;
  }): FirebaseUser {
    return {
      uid: token.firebaseUid,
      phoneNumber: token.phoneNumber,
      email: null,
      name: null,
      picture: null,
      emailVerified: false,
    };
  }
}
