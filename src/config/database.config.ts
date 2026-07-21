import { registerAs } from '@nestjs/config';

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function booleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'require'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disable'].includes(normalized)) {
    return false;
  }
  return undefined;
}

export default registerAs('database', () => {
  const databaseUrl = optional(process.env.DATABASE_URL);
  const host = process.env.DB_HOST?.trim() ?? 'localhost';
  const sslDetected =
    databaseUrl?.includes('sslmode=require') === true ||
    host.includes('neon.tech');

  return {
    url: databaseUrl,
    host,
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME?.trim() ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_DATABASE?.trim() ?? 'food_app',
    ssl: booleanEnv(process.env.DB_SSL) ?? sslDetected,
    sslRejectUnauthorized:
      booleanEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false,
  };
});
