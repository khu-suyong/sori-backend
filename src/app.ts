import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requestId } from 'hono/request-id';

import { logger } from './lib/logger';
import { db } from './lib/db';

import { router } from './route';

const app = new Hono();

app.use('*', requestId(), logger(), cors(), secureHeaders(), db());
app.route('/api', router());

export { app };
