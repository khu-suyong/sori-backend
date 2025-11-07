import { Hono } from 'hono';

import { router as v1Router } from './v1';

export const router = () => {
  const router = new Hono();
  router.route('/v1', v1Router());

  return router;
};
