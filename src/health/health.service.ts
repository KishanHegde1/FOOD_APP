import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface HealthResponse {
  status: 'ok';
  service: 'food-app-backend';
  database: 'connected';
  environment: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  async check(): Promise<HealthResponse> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({
        success: false,
        statusCode: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Database is unavailable.',
        details: null,
      });
    }

    return {
      status: 'ok',
      service: 'food-app-backend',
      database: 'connected',
      environment: process.env.NODE_ENV ?? 'development',
      timestamp: new Date().toISOString(),
    };
  }
}
