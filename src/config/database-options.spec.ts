import { buildPostgresOptions } from './database-options';

describe('buildPostgresOptions', () => {
  it('prefers DATABASE_URL and enables SSL for Neon URLs', () => {
    expect(
      buildPostgresOptions({
        DATABASE_URL:
          'postgresql://user:pass@example.neon.tech/db?sslmode=require',
      }),
    ).toMatchObject({
      type: 'postgres',
      url: 'postgresql://user:pass@example.neon.tech/db?sslmode=require',
      ssl: { rejectUnauthorized: false },
      synchronize: false,
    });
  });

  it('uses local fallback settings when DATABASE_URL is missing', () => {
    expect(
      buildPostgresOptions({
        DB_HOST: 'localhost',
        DB_PORT: '2006',
        DB_USERNAME: 'postgres',
        DB_PASSWORD: 'password',
        DB_DATABASE: 'food_app',
        DB_SSL: 'false',
      }),
    ).toMatchObject({
      host: 'localhost',
      port: 2006,
      username: 'postgres',
      database: 'food_app',
      ssl: false,
      synchronize: false,
    });
  });

  it('parses SSL rejectUnauthorized as a real boolean', () => {
    expect(
      buildPostgresOptions({
        DATABASE_URL:
          'postgresql://user:pass@example.neon.tech/db?sslmode=require',
        DB_SSL: 'true',
        DB_SSL_REJECT_UNAUTHORIZED: 'false',
      }),
    ).toMatchObject({ ssl: { rejectUnauthorized: false } });
  });
});
