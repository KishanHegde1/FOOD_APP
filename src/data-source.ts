import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildPostgresOptions } from './config/database-options';

/**
 * CLI-only data source for explicit schema migrations. Runtime connection
 * configuration remains in AppModule and keeps synchronize disabled.
 */
const dataSource = new DataSource({
  ...buildPostgresOptions(process.env),
  migrations: [join(__dirname, 'migrations/*{.ts,.js}')],
  migrationsTableName: 'typeorm_migrations',
  migrationsTransactionMode: 'each',
  synchronize: false,
});

export default dataSource;
