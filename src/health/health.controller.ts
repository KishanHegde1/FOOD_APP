import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthService, HealthResponse } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Public health check for Render and uptime probes' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        service: 'food-app-backend',
        database: 'connected',
        environment: 'production',
        timestamp: '2026-07-21T13:00:00.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'Database unavailable.' })
  async health(): Promise<HealthResponse> {
    return this.healthService.check();
  }

  @Get('ready')
  @ApiOperation({ summary: 'Public readiness check' })
  @ApiOkResponse({ description: 'Application is ready.' })
  @ApiServiceUnavailableResponse({ description: 'Database unavailable.' })
  async ready(): Promise<HealthResponse> {
    return this.healthService.check();
  }
}
