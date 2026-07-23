import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';
import {
  BackendAccessTokenPayload,
  IssuedBackendAccessToken,
} from './interfaces/backend-access-token.interface';

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueAccessToken(user: User): Promise<IssuedBackendAccessToken> {
    const firebaseUid = user.firebaseUid?.trim();
    if (!firebaseUid) {
      throw new ServiceUnavailableException(
        'The authenticated user is not linked to Firebase.',
      );
    }

    const expiresIn = this.accessTokenLifetimeSeconds();
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        firebaseUid,
        phoneNumber: user.phone,
        tokenType: 'access',
      } satisfies BackendAccessTokenPayload,
      {
        secret: this.requiredSecret(),
        expiresIn,
      },
    );

    return { accessToken, tokenType: 'Bearer', expiresIn };
  }

  async verifyAccessToken(
    token: string,
  ): Promise<BackendAccessTokenPayload | null> {
    const secret = this.configuredSecret();
    if (!secret) return null;

    try {
      const payload =
        await this.jwtService.verifyAsync<BackendAccessTokenPayload>(token, {
          secret,
        });
      return this.isAccessPayload(payload) ? payload : null;
    } catch {
      return null;
    }
  }

  private requiredSecret(): string {
    const secret = this.configuredSecret();
    if (!secret) {
      throw new ServiceUnavailableException(
        'JWT signing is not configured. Set JWT_SECRET in the server environment.',
      );
    }
    return secret;
  }

  private configuredSecret(): string | null {
    const secret = this.configService.get<string>('jwt.secret')?.trim();
    return secret || null;
  }

  private accessTokenLifetimeSeconds(): number {
    const configured = this.configService.get<string>('jwt.expiresIn') ?? '7d';
    const match = /^(\d+)\s*([smhdw])$/i.exec(configured.trim());
    if (!match) return 7 * 24 * 60 * 60;

    const quantity = Number(match[1]);
    const multiplier =
      {
        s: 1,
        m: 60,
        h: 60 * 60,
        d: 24 * 60 * 60,
        w: 7 * 24 * 60 * 60,
      }[match[2].toLowerCase()] ?? 0;
    const seconds = quantity * multiplier;
    return Number.isSafeInteger(seconds) && seconds > 0
      ? seconds
      : 7 * 24 * 60 * 60;
  }

  private isAccessPayload(
    payload: BackendAccessTokenPayload,
  ): payload is BackendAccessTokenPayload {
    return (
      typeof payload?.sub === 'string' &&
      typeof payload.firebaseUid === 'string' &&
      typeof payload.phoneNumber === 'string' &&
      payload.tokenType === 'access'
    );
  }
}
