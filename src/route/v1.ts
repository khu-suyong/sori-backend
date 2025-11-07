import { Hono } from 'hono';

import { auth } from '../modules/auth/auth.route';

export const router = () => {
  const router = new Hono();

  router.get('/health', c => c.json({ ok: true }));
  router.route('/auth', auth);

  return router;
};
