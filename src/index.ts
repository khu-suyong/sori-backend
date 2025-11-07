import { serve } from '@hono/node-server';
import 'dotenv/config';
import './lib/config'; // config checks

import { app } from './app';

serve({
  fetch: app.fetch,
  port: 3000,
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`);
});
