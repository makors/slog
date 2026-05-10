import { drizzle } from 'drizzle-orm/bun-sql';
import { SQL } from 'bun';
import * as schema from '@/db/schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);

declare global {
  var __slogSql: SQL | undefined;
}

const client =
  globalThis.__slogSql ??
  new SQL({
    url: databaseUrl,
    max: poolMax,
    idleTimeout: 30,
    connectionTimeout: 10,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__slogSql = client;
}

export const db = drizzle({ client, schema });
