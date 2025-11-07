import { createMiddleware } from 'hono/factory';
import { verifyToken } from '../modules/auth/auth.service';

const regex = /^Bearer\s+(.+)$/i;
export const jwt = () => createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization') ?? '';

  const match = header.match(regex);
  if (!match) return c.json({ message: 'Unauthorized' }, 401);
  
  const token = match[1];
  const payload = await verifyToken(token);
  const userId = payload.sub;

  c.set('userId', userId);
  c.var.log.info(`Authenticated user: ${userId}`);

  return next();
});

declare module 'hono' {
  interface ContextVariableMap {
    userId: string;
  }
}
