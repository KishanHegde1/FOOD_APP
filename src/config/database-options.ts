import type { DataSourceOptions } from 'typeorm';
import { optionalEnv, parseBooleanEnv } from './env.utils';

export type FoodAppPostgresOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
> & {
  autoLoadEntities?: boolean;
};

export function buildPostgresOptions(
  env: NodeJS.ProcessEnv,
  extra: Partial<FoodAppPostgresOptions> = {},
): FoodAppPostgresOptions {
  const databaseUrl = optionalEnv(env.DATABASE_URL);
  const databaseHost = env.DB_HOST?.trim() ?? 'localhost';
  const sslDetected =
    databaseUrl?.includes('sslmode=require') === true ||
    databaseUrl?.includes('sslmode=verify-full') === true ||
    databaseHost.includes('neon.tech');
  const sslEnabled = parseBooleanEnv(env.DB_SSL, sslDetected);
  const ssl = sslEnabled
    ? {
        rejectUnauthorized: parseBooleanEnv(
          env.DB_SSL_REJECT_UNAUTHORIZED,
          false,
        ),
      }
    : false;

  const options: FoodAppPostgresOptions = {
    type: 'postgres',
    ...(databaseUrl
      ? { url: databaseUrl }
      : {
          host: databaseHost,
          port: Number(env.DB_PORT ?? 2006),
          username: env.DB_USERNAME?.trim() ?? 'postgres',
          password: env.DB_PASSWORD ?? '',
          database: env.DB_DATABASE?.trim() ?? 'food_app',
        }),
    ssl,
    synchronize: false,
    logging: parseBooleanEnv(env.DB_LOGGING, false),
    ...extra,
  };
  return options;
}
