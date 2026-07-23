import { registerAs } from '@nestjs/config';

/**
 * Reserved shared JWT settings for a future token layer.
 *
 * The current application authenticates protected APIs with Firebase ID
 * tokens and does not issue a separate backend JWT.
 */
export default registerAs('jwt', () => ({
  secret: process.env.JWT_SECRET?.trim() || '',
  expiresIn: process.env.JWT_EXPIRES_IN?.trim() || '7d',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN?.trim() || '30d',
}));
