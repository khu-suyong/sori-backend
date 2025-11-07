import { vi } from 'vitest';
import type { MiddlewareHandler } from 'hono';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

export const prismaMock = mockDeep<PrismaClient>();

const applyDefaults = () => {
  prismaMock.$transaction.mockImplementation(async (cb) => cb(prismaMock));
};

applyDefaults();

export const resetPrismaMock = () => {
  mockReset(prismaMock);
  applyDefaults();
};

const attachPrisma: MiddlewareHandler = async (c, next) => {
  c.set('prisma', prismaMock);
  await next();
};

vi.mock('../../src/lib/db', () => ({
  db: () => attachPrisma,
  prisma: prismaMock,
}));
