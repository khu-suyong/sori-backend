import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';

import { logger } from './lib/logger';
import { db } from './lib/db';

import { router } from './route';
import { jsonError } from './lib/exception';
import { ZodError } from 'zod';

const app = new Hono();

app.use('*', requestId(), logger(), cors(), secureHeaders(), db());
app.route('/api', router());
app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof ZodError) return c.json({ error: 'validation_failed', issues: err.issues }, 422);

  return c.json({
    code: 'internal_server_error',
    message: '서버에서 알 수 없는 오류가 발생했습니다.',
  }, 500);
})

export { app };
