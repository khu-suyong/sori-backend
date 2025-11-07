import pino from 'pino';
import { logger as honoLogger } from 'hono/logger';

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

  return honoLogger((...messages) => log.info({ msg: messages.join(' ') }));
};
