import { registerAs } from '@nestjs/config';

/** Shared backend access-token settings issued after Firebase verification. */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET?.trim() || '',
  expiresIn: process.env.JWT_EXPIRES_IN?.trim() || '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '30d',
}));
