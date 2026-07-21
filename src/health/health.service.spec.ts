import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthService } from './health.service';

describe('HealthService', () => {
  it('returns a healthy response when the database is connected', async () => {
    const service = new HealthService({
      query: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    } as unknown as DataSource);

    await expect(service.check()).resolves.toMatchObject({
      status: 'ok',
      service: 'food-app-backend',
      database: 'connected',
    });
  });

  it('returns HTTP 503 when the database is unavailable', async () => {
    const service = new HealthService({
      query: jest.fn().mockRejectedValue(new Error('connection failed')),
    } as unknown as DataSource);

    await expect(service.check()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
