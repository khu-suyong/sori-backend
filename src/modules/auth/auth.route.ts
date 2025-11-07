import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { calculatePKCECodeChallenge, randomPKCECodeVerifier, randomState } from 'openid-client';

import { google } from './google';

import type { AuthProvider } from './provider';
import { IdTokenUserSchema, OauthTokensSchema } from './auth.schema';
import { generateToken, verifyToken } from './auth.service';

import { putUser } from '../user/user.service';
import { toPublicUser } from '../user/user.mapper';
import { jsonError } from '../../lib/exception';
import { jwtParser } from '../../lib/jwt';

const Providers: Record<string, AuthProvider> = {
  google,
};

const auth = new Hono();

auth.post('/refresh', jwtParser(), async (c) => {
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

  return c.json({ accessToken, refreshToken });
});
auth.get('/refresh', async () => {
  throw jsonError(405, {
    code: 'method_not_allowed',
  });
});

auth.get('/:provider_name', async (c) => {
  const { provider_name } = c.req.param();

  const provider = Providers[provider_name];
  if (!provider) {
    throw jsonError(400, {
      code: 'unsupported_provider',
      message: '지원하지 않는 인증 제공자입니다.',
    });
  }

  const verifier = randomPKCECodeVerifier()
  const challenge = await calculatePKCECodeChallenge(verifier)
  const state = randomState()

  setCookie(c, 'oauth_code_verifier', verifier, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 600, // 10분
  });
  setCookie(c, 'oauth_state', state, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    maxAge: 600, // 10분
  });

  const url = provider.buildAuthorizationUrl(challenge, state);
  return c.redirect(url.href);
});

auth.get('/:provider_name/callback', async (c) => {
  const { provider_name } = c.req.param();

  const provider = Providers[provider_name];
  if (!provider) {
    throw jsonError(400, {
      code: 'unsupported_provider',
      message: '지원하지 않는 인증 제공자입니다.',
    });
  }

  const currentUrl = new URL(c.req.url);

  const state = getCookie(c, 'oauth_state') ?? '';
  const verifier = getCookie(c, 'oauth_code_verifier') ?? '';
  if (!currentUrl.searchParams.get('code') || !state) {
    throw jsonError(400, {
      code: 'invalid_oauth_request',
      message: '잘못된 요청입니다.',
    });
  }

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

  return c.json({ user: toPublicUser(user), accessToken, refreshToken });
});

export { auth };
