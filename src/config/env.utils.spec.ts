import {
  parseBooleanEnv,
  parseCorsOrigins,
  parsePortEnv,
  validateEnvironment,
} from './env.utils';

describe('env utils', () => {
  it('parses boolean environment values without treating false as truthy', () => {
    expect(parseBooleanEnv('true')).toBe(true);
    expect(parseBooleanEnv('1')).toBe(true);
    expect(parseBooleanEnv('yes')).toBe(true);
    expect(parseBooleanEnv('on')).toBe(true);
    expect(parseBooleanEnv('false', true)).toBe(false);
    expect(parseBooleanEnv('0', true)).toBe(false);
    expect(parseBooleanEnv('no', true)).toBe(false);
    expect(parseBooleanEnv('off', true)).toBe(false);
    expect(parseBooleanEnv('', true)).toBe(true);
  });

  it('parses comma-separated CORS origins', () => {
    expect(
      parseCorsOrigins(
        ' https://admin.example.com,https://restaurant.example.com , ',
      ),
    ).toEqual(['https://admin.example.com', 'https://restaurant.example.com']);
  });

  it('parses and validates the application port', () => {
    expect(parsePortEnv(undefined)).toBe(3000);
    expect(parsePortEnv('8080')).toBe(8080);
    expect(() => parsePortEnv('invalid')).toThrow(
      'PORT must be an integer between 1 and 65535.',
    );
    expect(() => parsePortEnv('70000')).toThrow(
      'PORT must be an integer between 1 and 65535.',
    );
  });

  it('requires production deployment variables without exposing values', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'Missing required production environment variables: DATABASE_URL, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH',
    );
  });

  it('allows production when required variables are present', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://example',
        RAZORPAY_KEY_ID: 'key',
        RAZORPAY_KEY_SECRET: 'secret',
        RAZORPAY_WEBHOOK_SECRET: 'webhook',
        FIREBASE_SERVICE_ACCOUNT_PATH:
          '/etc/secrets/firebase-service-account.json',
      }),
    ).toMatchObject({ NODE_ENV: 'production' });
  });
});
