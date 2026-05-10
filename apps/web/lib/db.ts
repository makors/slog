import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '@/db/schema';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 5);
const { Pool } = pg;

type PgPool = InstanceType<typeof Pool>;

declare global {
  var __slogPgPool: PgPool | undefined;
}

const pool =
  globalThis.__slogPgPool ??
  new Pool({
    connectionString: databaseUrl,
    max: poolMax,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__slogPgPool = pool;
}

export const db = drizzle(pool, { schema });
