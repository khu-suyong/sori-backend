import { createMiddleware } from 'hono/factory';
import { every } from 'hono/combine';

import { jsonError } from './exception';

import { verifyToken } from '../modules/auth/auth.service';
import type { ExceptionBody } from '../modules/common/common.schema';

const ErrorMap: Record<string, ExceptionBody> = {
  JwtAlgorithmNotImplemented: {
    code: 'unsupported_token_algorithm',
    message: '지원하지 않는 토큰 알고리즘입니다.',
  },
  JwtTokenInvalid: {
    code: 'invalid_token',
    message: '유효하지 않은 토큰입니다.',
  },
  JwtTokenNotBefore: {
    code: 'token_not_active',
    message: '아직 유효하지 않은 토큰입니다.',
  },
  JwtTokenExpired: {
    code: 'token_expired',
    message: '토큰이 만료되었습니다.',
  },
  JwtTokenIssuedAt: {
    code: 'invalid_issued_at',
    message: '토큰의 발급 시간이 올바르지 않습니다.',
  },
  JwtTokenIssuer: {
    code: 'invalid_issuer',
    message: '토큰의 발급자가 올바르지 않습니다.',
  },
  JwtTokenSignatureMismatched: {
    code: 'invalid_signature',
    message: '토큰 서명이 올바르지 않습니다.',
  },
};

const regex = /^Bearer\s+(.+)$/i;
export const jwtParser = () => createMiddleware<{
  Variables: {
    token: string;
  }
}>(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header) {
    throw jsonError(401, {
      code: 'missing_authorization_header',
      message: 'Authorization 헤더가 존재하지 않습니다.',
    });
  }

  const match = header.match(regex);
  if (!match) {
    throw jsonError(401, {
      code: 'invalid_authorization_header',
      message: 'Authorization 헤더 형식이 올바르지 않습니다.',
    });
  }

  const token = match[1];
  c.set('token', token);

  return next();
});
export const verifyJwt = () => createMiddleware<{
  Variables: {
    token: string;
    userId: string;
  }
}>(async (c, next) => {
  const token = c.get('token');

  try {
    const payload = await verifyToken(token);
    const userId = payload.sub;

    c.set('userId', userId);
    c.var.log.info(`Authorization: userId=${userId}`);
  } catch (error) {
    if (error instanceof Error) {
      const info = ErrorMap[error.name];

      if (info) throw jsonError(401, info);
    }

    throw jsonError(401, {
      code: 'token_verification_failed',
      message: '토큰 검증에 실패했습니다.',
    });
  }

  return next();
});

export const jwt = () => every(
  jwtParser(),
  verifyJwt(),
);

declare module 'hono' {
  interface ContextVariableMap {
    token: string;
    userId: string;
  }
}
