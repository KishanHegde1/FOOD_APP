import { registerAs } from '@nestjs/config';
import { parseBooleanEnv } from './env.utils';

export default registerAs('database', () => {
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
  const host = process.env.DB_HOST?.trim() ?? 'localhost';
  const sslDetected =
    databaseUrl?.includes('sslmode=require') === true ||
    databaseUrl?.includes('sslmode=verify-full') === true ||
    host.includes('neon.tech');

  return {
    url: databaseUrl,
    host,
    port: Number(process.env.DB_PORT ?? 2006),
    username: process.env.DB_USERNAME?.trim() ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE?.trim() ?? 'food_app',
    ssl: parseBooleanEnv(process.env.DB_SSL, sslDetected),
    sslRejectUnauthorized: parseBooleanEnv(
      process.env.DB_SSL_REJECT_UNAUTHORIZED,
      false,
    ),
  };
});
