import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { ExceptionBody } from '../modules/common/common.schema';

type JsonErrorOptions = {
  code: string;
  message?: string;
  cause?: unknown;
}
export const jsonError = (status: ContentfulStatusCode, body: JsonErrorOptions) => {
  const res = Response.json(
    {
      code: body.code,
      message: body.message,
    } satisfies ExceptionBody,
    {
      status,
      headers: {
        'content-type': 'application/json',
      },
    },
  );

  return new HTTPException(
    status,
    {
      res,
      message: body.message,
      cause: body.cause,
    },
  );
};
