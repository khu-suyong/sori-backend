import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { calculatePKCECodeChallenge, randomPKCECodeVerifier, randomState } from 'openid-client';

import { google } from './google';

import type { AuthProvider } from './provider';
import { IdTokenUserSchema, OauthTokensSchema } from './auth.schema';
import { generateToken } from './auth.service';

import { putUser } from '../user/user.service';
import { toPublicUser } from '../user/user.mapper';

const Providers: Record<string, AuthProvider> = {
  google,
};

const auth = new Hono();

auth.post('/refresh', async (c) => {
  return c.text('Not implemented', 501);
});

auth.get('/:provider_name', async (c) => {
  const { provider_name } = c.req.param();

  const provider = Providers[provider_name];
  if (!provider) return c.text('Unsupported provider', 400);

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
  if (!provider) return c.text('Unsupported provider', 400);

  const currentUrl = new URL(c.req.url);

  const state = getCookie(c, 'oauth_state') ?? '';
  const verifier = getCookie(c, 'oauth_code_verifier') ?? '';
  if (!currentUrl.searchParams.get('code') || !state) return c.text('bad request', 400);

  const tokens = await provider.authorizationCodeGrant(currentUrl, verifier, state);
  const parsedTokens = OauthTokensSchema.safeParse(tokens);
  if (!parsedTokens.success) return c.text('Invalid tokens', 400);

  const idToken = tokens.claims();
  if (!idToken) return c.text('Failed to get id token', 500);

  const parsedIdToken = IdTokenUserSchema.safeParse(idToken);
  if (!parsedIdToken.success) return c.text('Invalid id token', 400);
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
  const { accessToken, refreshToken } = await generateToken(user);

  return c.json({ user: toPublicUser(user), accessToken, refreshToken });
});

export { auth };
