import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

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

const databaseUrl = optional(process.env.DATABASE_URL);
const databaseHost = process.env.DB_HOST?.trim() ?? 'localhost';
const sslDetected =
  databaseUrl?.includes('sslmode=require') === true ||
  databaseHost.includes('neon.tech');
const sslEnabled = booleanEnv(process.env.DB_SSL) ?? sslDetected;
const ssl = sslEnabled
  ? {
      rejectUnauthorized:
        booleanEnv(process.env.DB_SSL_REJECT_UNAUTHORIZED) ?? false,
    }
  : false;

/**
 * CLI-only data source for explicit schema migrations. Runtime connection
 * configuration remains in AppModule and keeps synchronize disabled.
 */
const dataSource = new DataSource({
  type: 'postgres',
  ...(databaseUrl
    ? { url: databaseUrl }
    : {
        host: databaseHost,
        port: Number(process.env.DB_PORT ?? 5432),
        username: process.env.DB_USERNAME?.trim() ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_DATABASE?.trim() ?? 'food_app',
      }),
  ssl,
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  synchronize: false,
});

export default dataSource;
