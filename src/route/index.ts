import { OpenAPIHono } from '@hono/zod-openapi';

import { router as v1Router } from './v1';

export const router = () => {
  const router = new OpenAPIHono();
  router.route('/v1', v1Router());

  return router;
};
