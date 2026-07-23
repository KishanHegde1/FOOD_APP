import { registerAs } from '@nestjs/config';
import { parseBooleanEnv, parseCorsOrigins, parsePortEnv } from './env.utils';

export default registerAs('app', () => ({
  environment: process.env.NODE_ENV?.trim() || 'development',
  port: parsePortEnv(process.env.PORT),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
  swaggerEnabled: parseBooleanEnv(process.env.SWAGGER_ENABLED, true),
}));
