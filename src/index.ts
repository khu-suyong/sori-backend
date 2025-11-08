import { serve } from '@hono/node-server';
import 'dotenv/config';
import './lib/config'; // config checks

import { app, initApp } from './app';

import { initWs, injectWebSocket } from './lib/ws';

(async () => {
  initWs(app);
  await initApp();

  const server = serve({
    fetch: app.fetch,
    port: 3000,
  }, (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  });

  injectWebSocket(server);
})();
