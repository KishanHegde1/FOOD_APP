import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { ValidateDineInQrDto } from './dto/validate-dine-in-qr.dto';

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

  parseDeepLink(value: string): ValidateDineInQrDto | null {
    const payload = value.trim();
    if (!payload || payload.length > 2048) return null;

    let url: URL;
    try {
      url = new URL(payload);
    } catch {
      return null;
    }
    if (url.protocol !== 'foodapp:' || url.hostname !== 'dine-in') {
      return null;
    }

    const restaurantId = this.singleQueryValue(url, 'restaurantId');
    const tableId = this.singleQueryValue(url, 'tableId');
    const token = this.singleQueryValue(url, 'token');
    const version = this.singleQueryValue(url, 'version');
    if (!restaurantId || !tableId || !token || !version) return null;
    if (!this.isUuid(restaurantId) || !this.isUuid(tableId)) return null;
    if (token.length > 512) return null;
    const parsedVersion = Number(version);
    if (
      !Number.isInteger(parsedVersion) ||
      parsedVersion < 1 ||
      parsedVersion > 2_147_483_647
    ) {
      return null;
    }

    return { restaurantId, tableId, token, version: parsedVersion };
  }

  private singleQueryValue(url: URL, key: string): string | null {
    const values = url.searchParams.getAll(key);
    return values.length === 1 ? values[0].trim() || null : null;
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }
}
