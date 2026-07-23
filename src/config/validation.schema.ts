import { validateEnvironment } from './env.utils';

/**
 * Central startup validation entrypoint.
 *
 * The project intentionally avoids adding a schema library dependency here;
 * `validateEnvironment` keeps production requirements explicit while allowing
 * local development to use DATABASE_URL or the legacy DB_* variables.
 */
export const validateEnv = validateEnvironment;
