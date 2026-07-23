export function optionalEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseBooleanEnv(
  value: string | undefined,
  defaultValue = false,
): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (['1', 'true', 'yes', 'on', 'require'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off', 'disable'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

export function parseCorsOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function parsePortEnv(
  value: string | undefined,
  defaultValue = 3000,
): number {
  const normalized = optionalEnv(value);
  if (!normalized) return defaultValue;

  const port = Number(normalized);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

export function isProductionEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV?.trim().toLowerCase() === 'production';
}

export function validateEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!isProductionEnv(env)) return env;

  const missing = [
    'DATABASE_URL',
    'RAZORPAY_KEY_ID',
    'RAZORPAY_KEY_SECRET',
    'RAZORPAY_WEBHOOK_SECRET',
    'JWT_SECRET',
  ].filter((key) => !optionalEnv(env[key]));

  if (
    !optionalEnv(env.FIREBASE_SERVICE_ACCOUNT_JSON) &&
    !optionalEnv(env.FIREBASE_SERVICE_ACCOUNT_PATH)
  ) {
    missing.push(
      'FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH',
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(', ')}`,
    );
  }

  return env;
}
