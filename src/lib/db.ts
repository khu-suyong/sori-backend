import { createMiddleware } from 'hono/factory';
import { PrismaClient } from '@prisma/client';

import { Env as Environment } from './config';

const g = globalThis as any;
export const prisma: PrismaClient = g.prisma ?? new PrismaClient();
if (!Environment.IS_PRODUCTION) g.prisma = prisma;

export const db = () => createMiddleware(async (c, next) => {
  c.set('prisma', prisma);
  await next();
});

declare module 'hono' {
  interface ContextVariableMap {
    prisma: PrismaClient;
  }
}
