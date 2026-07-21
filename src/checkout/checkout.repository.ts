import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Address } from '../addresses/entities/address.entity';
import { Restaurant } from '../restaurants/entities/restaurant.entity';

@Injectable()
export class CheckoutRepository {
  constructor(private readonly dataSource: DataSource) {}

  async calculateDistanceKm(
    restaurant: Restaurant,
    address: Address,
  ): Promise<number | null> {
    if (
      restaurant.latitude === null ||
      restaurant.longitude === null ||
      address.latitude === null ||
      address.longitude === null
    ) {
      return null;
    }

    const result: unknown = await this.dataSource.query(
      `SELECT ST_Distance(
        ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
        ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography
      ) / 1000 AS distance_km`,
      [
        Number(restaurant.longitude),
        Number(restaurant.latitude),
        Number(address.longitude),
        Number(address.latitude),
      ],
    );

    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }
    const rows = result as unknown[];
    const firstRow: unknown = rows[0];
    if (typeof firstRow !== 'object' || firstRow === null) {
      return null;
    }
    const distanceKm = (firstRow as Record<string, unknown>).distance_km;
    return typeof distanceKm === 'number' || typeof distanceKm === 'string'
      ? Number(distanceKm)
      : null;
  }
}
