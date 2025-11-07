import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

import { logger } from './lib/logger';

import { router } from './route/v1';

const app = new Hono();

app.use('*', requestId(), logger(), cors(), secureHeaders());
app.route('/api/v1', router());

export { app };
