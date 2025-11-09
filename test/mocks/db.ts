import { execSync } from 'node:child_process';

import { vi } from 'vitest';
import type { MiddlewareHandler } from 'hono';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';

let container: StartedPostgreSqlContainer | null = null;
let prisma: PrismaClient | null = null;

const migrateDatabase = (connectionUri: string) => {
  execSync('pnpm prisma db push --accept-data-loss', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: connectionUri,
    },
  });
};

export const setupTestDatabase = async () => {
  if (prisma) return prisma;

  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('sori')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const connectionUri = container.getConnectionUri();
  process.env.DATABASE_URL = connectionUri;
  migrateDatabase(connectionUri);

  prisma = new PrismaClient({
    datasourceUrl: connectionUri,
  });
  await prisma.$connect();

  return prisma;
};

export const getTestPrisma = () => {
  if (!prisma) throw new Error('Test Prisma has not been initialized. Call setupTestDatabase() first.');
  return prisma;
};

export const resetTestDatabase = async () => {
  const client = await setupTestDatabase();
  const tables = ['Account', 'Note', 'Folder', 'Workspace', 'Server', 'User'];

  for (const table of tables) {
    await client.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`);
  }
};

export const teardownTestDatabase = async () => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (container) {
    await container.stop();
    container = null;
  }
};

const attachPrisma: MiddlewareHandler = async (c, next) => {
  const client = await setupTestDatabase();
  c.set('prisma', client);
  await next();
};

vi.mock('../../src/lib/db', () => ({
  db: () => attachPrisma,
  get prisma() {
    return prisma;
  },
}));
