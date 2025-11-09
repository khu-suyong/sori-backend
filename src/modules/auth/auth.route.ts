import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { getCookie, setCookie } from 'hono/cookie';
import { calculatePKCECodeChallenge, randomPKCECodeVerifier, randomState } from 'openid-client';

import { google } from './google';

import type { AuthProvider } from './provider';
import { IdTokenUserSchema, OauthTokensSchema, PublicTokenSchema, PublicTokenWithUserSchema } from './auth.schema';
import { generateToken, verifyToken } from './auth.service';

import { putUser } from '../user/user.service';
import { toPublicUser } from '../user/user.mapper';
import { ExceptionBodySchema } from '../common/common.schema';

import { jsonError } from '../../lib/exception';
import { jwtParser } from '../../lib/jwt';

const Providers: Record<string, AuthProvider> = {
  google,
};

const auth = new OpenAPIHono();

const refreshTokenRoute = createRoute({
  method: 'post',
  path: '/refresh',
  description: '리프레시 토큰으로 새로운 액세스/리프레시 토큰을 발급합니다.',
  tags: ['Auth'],
  summary: '리프레시 토큰 재발급',
  middleware: [jwtParser()],
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PublicTokenSchema,
        },
      },
      description: '새롭게 발급된 액세스/리프레시 토큰.',
    },
    401: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: 'Authorization 헤더가 없거나 리프레시 토큰이 유효하지 않은 경우.',
    },
  },
  security: [
    {
      RefreshToken: [],
    },
  ],
});
auth.openapi(refreshTokenRoute, async (c) => {
  const token = c.get('token');

  const result = await verifyToken(token, 'auth').catch((err) => err);
  if (result instanceof Error) {
    throw jsonError(401, {
      code: 'invalid_token',
      message: '유효하지 않은 토큰입니다. 헤더에 access token이 아닌 refresh token이 포함되어야 합니다.',
      cause: result,
    });
  }

  const { accessToken, refreshToken } = await generateToken(result.sub);

  return c.json({ accessToken, refreshToken }, 200);
});
auth.get('/refresh', async () => {
  throw jsonError(405, {
    code: 'method_not_allowed',
  });
});

const oauthRoute = createRoute({
  method: 'get',
  path: '/{provider_name}',
  description: '요청한 인증 제공자의 OAuth 인증을 시작합니다.',
  tags: ['Auth'],
  summary: 'OAuth 인증 시작',
  request: {
    query: z.object({
      redirect: z.url(),
    }),
    params: z.object({
      'provider_name': z.enum(['google']),
    }),
  },
  responses: {
    302: {
      description: '인증 제공자 인증 페이지로 리디렉션합니다.',
    },
    400: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: '지원하지 않는 인증 제공자 등으로 요청이 거부된 경우.',
    },
  },
});
auth.openapi(
  oauthRoute,
  async (c) => {
    const { provider_name } = c.req.param();
    const { redirect } = c.req.query();

    const provider = Providers[provider_name];
    if (!provider) {
      throw jsonError(400, {
        code: 'unsupported_provider',
        message: '지원하지 않는 인증 제공자입니다.',
      });
    }

    const verifier = randomPKCECodeVerifier();
    const challenge = await calculatePKCECodeChallenge(verifier);
    const state = randomState();
    const stateBody = `state=${state}&redirect=${encodeURIComponent(redirect)}`;

    setCookie(c, 'oauth_code_verifier', verifier, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 600, // 10분
    });
    setCookie(c, 'oauth_state', stateBody, {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      maxAge: 600, // 10분
    });

    const url = provider.buildAuthorizationUrl(challenge, state);
    return c.redirect(url.href);
  },
  (result) => {
    if (!result.success) {
      throw jsonError(400, {
        code: 'unsupported_provider',
        message: '지원하지 않는 인증 제공자입니다.',
      });
    }

    return undefined;
  },
);

const oauthCallbackRoute = createRoute({
  method: 'get',
  path: '/{provider_name}/callback',
  description: 'OAuth 콜백을 처리하고 유저 정보와 토큰을 발급합니다.',
  tags: ['Auth'],
  summary: 'OAuth 콜백 처리',
  request: {
    params: z.object({
      'provider_name': z.enum(['google']),
    }),
  },
  responses: {
    302: {
      description: '인증된 유저 아이디와 발급된 액세스/리프레시 토큰을 가지고 리디렉션합니다.',
    },
    400: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: '지원하지 않는 인증 제공자이거나 유효하지 않은 OAuth 요청인 경우.',
    },
    500: {
      content: {
        'application/json': {
          schema: ExceptionBodySchema,
        },
      },
      description: 'OAuth 토큰 검증 중 서버 오류가 발생한 경우.',
    },
  },
});
auth.openapi(
  oauthCallbackRoute,
  async (c) => {
    const { provider_name } = c.req.param();

    const provider = Providers[provider_name];
    if (!provider) {
      throw jsonError(400, {
        code: 'unsupported_provider',
        message: '지원하지 않는 인증 제공자입니다.',
      });
    }

    const currentUrl = new URL(c.req.url);

    const stateBody = getCookie(c, 'oauth_state') ?? '';
    const verifier = getCookie(c, 'oauth_code_verifier') ?? '';
    if (!currentUrl.searchParams.get('code') || !stateBody) {
      throw jsonError(400, {
        code: 'invalid_oauth_request',
        message: '잘못된 요청입니다.',
      });
    }

    const parsed = stateBody.match(/state=([^&]*)&redirect=(.+)$/);
    if (!parsed) {
      throw jsonError(400, {
        code: 'invalid_oauth_state',
        message: '잘못된 상태 값입니다.',
      });
    }
    const [, state, redirect] = parsed;

    const tokens = await provider.authorizationCodeGrant(currentUrl, verifier, state);
    const parsedTokens = await OauthTokensSchema.spa(tokens);
    if (!parsedTokens.success) {
      throw jsonError(500, {
        code: 'invalid_oauth_tokens',
        message: '인증 제공자로 부터 잘못된 토큰 응답을 받았습니다.',
      });
    }

    const idToken = tokens.claims();
    if (!idToken) {
      throw jsonError(500, {
        code: 'missing_id_token',
        message: 'ID 토큰이 존재하지 않습니다.',
      });
    }

    const parsedIdToken = await IdTokenUserSchema.spa(idToken);
    if (!parsedIdToken.success) {
      throw jsonError(500, {
        code: 'invalid_id_token',
        message: '잘못된 ID 토큰입니다.',
      });
    }
    const userInput = parsedIdToken.data;

    const user = await putUser(
      c.var.prisma,
      {
        email: userInput.email,
        name: userInput.name,
        image: userInput.picture ?? null,
      },
      {
        provider: provider_name,
        providerAccountId: userInput.sub,
        accessToken: parsedTokens.data.access_token,
        refreshToken: parsedTokens.data.refresh_token,
        expiresAt: parsedTokens.data.expires_in,
        scope: parsedTokens.data.scope,
      },
    );
    const { accessToken, refreshToken } = await generateToken(user.id);

    try {
      const baseUrl = decodeURIComponent(redirect);
      const url = new URL(baseUrl);
      url.searchParams.set('accessToken', accessToken);
      url.searchParams.set('refreshToken', refreshToken);
      url.searchParams.set('userId', user.id);

      return c.redirect(url.href);
    } catch (err) {
      c.var.log.debug('Redirect URL 처리 중 오류 발생');
      throw jsonError(400, {
        code: 'invalid_redirect_url',
        message: '리디렉션 URL 처리 중 오류가 발생했습니다.',
        cause: err instanceof Error ? err : undefined,
      });
    }
  },
  (result) => {
    if (!result.success) {
      throw jsonError(400, {
        code: 'unsupported_provider',
        message: '지원하지 않는 인증 제공자입니다.',
      });
    }

    return undefined;
  },
);

export { auth };
