import pino from 'pino';
import { logger as honoLogger } from 'hono/logger';
import { createMiddleware } from 'hono/factory';
import { every } from 'hono/combine';

import { Env } from './config';

export const logger = () => {
  const transport = pino.transport({
    target: 'pino-pretty',
    options: { singleLine: true, colorize: true, translateTime: 'SYS:standard' },
  });
  const log = pino(
    {
      level: Env.IS_PRODUCTION ? 'info' : 'debug',
    },
    Env.IS_PRODUCTION ? undefined : transport,
  );

  const innerMiddleware = createMiddleware(async (c, next) => {
    c.set('log', log);
    await next();

    if (c.error) {
      if (c.res.status === 500) {
        log.error({ err: c.error });
      } else {
        log.warn({ err: c.error });
      }
    }
  });

  return every(
    innerMiddleware,
    honoLogger((...messages) => log.info({ msg: messages.join(' ') })),
  );
};

declare module 'hono' {
  interface ContextVariableMap {
    log: pino.Logger;
  }
}
