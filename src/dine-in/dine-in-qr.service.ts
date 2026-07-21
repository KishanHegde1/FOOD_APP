import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class DineInQrService {
  generateToken(): { rawToken: string; tokenHash: string } {
    const rawToken = randomBytes(32).toString('base64url');
    return { rawToken, tokenHash: this.hashToken(rawToken) };
  }

  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken, 'utf8').digest('hex');
  }

  matchesHash(rawToken: string, storedHash: string): boolean {
    const providedHash = Buffer.from(this.hashToken(rawToken), 'hex');
    const persistedHash = Buffer.from(storedHash, 'hex');

    return (
      persistedHash.length === providedHash.length &&
      timingSafeEqual(persistedHash, providedHash)
    );
  }

  createSessionNumber(now = new Date()): string {
    const date = [
      now.getUTCFullYear(),
      String(now.getUTCMonth() + 1).padStart(2, '0'),
      String(now.getUTCDate()).padStart(2, '0'),
    ].join('');
    const suffix = randomBytes(8).toString('hex').toUpperCase();
    return `DIN-${date}-${suffix}`;
  }

  createDeepLink(
    restaurantId: string,
    tableId: string,
    version: number,
    rawToken: string,
  ): string {
    const params = new URLSearchParams({
      restaurantId,
      tableId,
      version: String(version),
      token: rawToken,
    });
    return `foodapp://dine-in?${params.toString()}`;
  }
}
