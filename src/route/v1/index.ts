import { Hono } from 'hono';

export const router = () => {
  const route = new Hono();

  route.get('/health', c => c.json({ ok: true }));

  return route;
};
