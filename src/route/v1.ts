import { OpenAPIHono } from '@hono/zod-openapi';

import { auth } from '../modules/auth/auth.route';
import { user } from '../modules/user/user.route';

export const router = () => {
  const router = new OpenAPIHono();

  router.get('/health', c => c.json({ ok: true }));
  router.route('/auth', auth);
  router.route('/user', user);

  return router;
};
