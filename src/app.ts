import { OpenAPIHono } from '@hono/zod-openapi';
import { ZodError } from 'zod';

import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { HTTPException } from 'hono/http-exception';
import { requestId } from 'hono/request-id';

import { logger } from './lib/logger';
import { db } from './lib/db';

import { router } from './route';
import { swaggerUI } from '@hono/swagger-ui';

const app = new OpenAPIHono();

app.use('*', requestId(), logger(), cors(), secureHeaders(), db());
app.route('/api', router());
app.doc('/docs', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Sori Backend',
  },
  tags: [
    { name: 'Users', description: '사용자 도메인' },
    { name: 'Auth', description: '인증/인가' },
    { name: 'Workspace', description: '워크스페이스' },
    { name: 'Server', description: '외부 서버' },
  ],
});
app.openAPIRegistry.registerComponent('securitySchemes', 'AccessToken', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'jwt',
  description: '액세스 토큰을 사용하는 API에서 사용됩니다.',
});
app.openAPIRegistry.registerComponent('securitySchemes', 'RefreshToken', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'jwt',
  description: '리프레시 토큰을 사용하는 API에서 사용됩니다.',
});
app.get('/swagger', swaggerUI({ url: '/docs' }));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  if (err instanceof ZodError) return c.json({ error: 'validation_failed', issues: err.issues }, 422);

  return c.json({
    code: 'internal_server_error',
    message: '서버에서 알 수 없는 오류가 발생했습니다.',
  }, 500);
});

export { app };
