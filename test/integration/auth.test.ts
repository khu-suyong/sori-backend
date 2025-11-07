import { describe, expect, it } from 'vitest';
import type { User as PrismaUser } from '@prisma/client';

import { app } from '../../src/app';
import { createMockOauthTokens, oauthMock } from '../mocks/oauth';
import { prismaMock } from '../mocks/db';
import { generateToken, verifyToken } from '../../src/modules/auth/auth.service';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const buildCookieHeader = (entries: Record<string, string>) => (
  Object.entries(entries).map(([key, value]) => `${key}=${value}`).join('; ')
);
const getSetCookies = (res: Response) => {
  const header = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (Array.isArray(header) && header.length) return header;

  const single = res.headers.get('set-cookie');
  return single ? [single] : [];
};

const makePrismaUser = (overrides: Partial<PrismaUser> = {}): PrismaUser => ({
  id: 'user-id',
  email: 'user@example.com',
  name: 'User',
  image: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
});

describe('auth.route.ts', () => {
  describe('POST /api/v1/auth/refresh', () => {
    it('issues new tokens when refresh token is valid', async () => {
      const initialTokens = await generateToken('user-42');

      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${initialTokens.refreshToken}` },
      });

      expect(res.status).toBe(200);
      const body = await readJson<{ accessToken: string; refreshToken: string; }>(res);
      const accessPayload = await verifyToken(body.accessToken);
      const refreshPayload = await verifyToken(body.refreshToken, 'auth');
      expect(accessPayload.sub).toBe('user-42');
      expect(refreshPayload.sub).toBe('user-42');
    });

    it('rejects invalid refresh tokens', async () => {
      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { Authorization: 'Bearer broken' },
      });

      expect(res.status).toBe(401);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_token' });
    });

    it('disallows GET access', async () => {
      const res = await app.request('/api/v1/auth/refresh');

      expect(res.status).toBe(405);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'method_not_allowed' });
    });
  });

  describe('GET /api/v1/auth/:provider', () => {
    it('rejects unsupported providers', async () => {
      const res = await app.request('/api/v1/auth/unknown');

      expect(res.status).toBe(400);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'unsupported_provider' });
    });

    it('redirects to provider authorization page and sets PKCE cookies', async () => {
      const res = await app.request('/api/v1/auth/google');

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toContain('https://oauth.example/authorize');
      const cookies = getSetCookies(res);
      expect(cookies.join(';')).toContain('oauth_code_verifier=');
      expect(cookies.join(';')).toContain('oauth_state=');
    });
  });

  describe('GET /api/v1/auth/:provider/callback', () => {
    const callbackPath = '/api/v1/auth/google/callback';
    const baseHeaders = {
      cookie: buildCookieHeader({
        oauth_state: 'stored-state',
        oauth_code_verifier: 'stored-verifier',
      }),
    };

    it('rejects unsupported providers', async () => {
      const res = await app.request('/api/v1/auth/unknown/callback');

      expect(res.status).toBe(400);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'unsupported_provider' });
    });

    it('rejects requests without OAuth code', async () => {
      const res = await app.request(`${callbackPath}?state=whatever`, { headers: baseHeaders });

      expect(res.status).toBe(400);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_oauth_request' });
    });

    it('rejects invalid token responses from provider', async () => {
      oauthMock.authorizationCodeGrant.mockResolvedValueOnce({
        token_type: 'Bearer',
        expires_in: 3600,
        claims: () => ({
          sub: 'abc',
          email: 'user@example.com',
          name: 'User',
        }),
      } as ReturnType<typeof createMockOauthTokens>);

      const res = await app.request(`${callbackPath}?code=oauth-code`, { headers: baseHeaders });

      expect(res.status).toBe(500);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_oauth_tokens' });
    });

    it('rejects missing id tokens', async () => {
      const tokens = createMockOauthTokens({
        claims: () => undefined,
      });
      oauthMock.authorizationCodeGrant.mockResolvedValueOnce(tokens);

      const res = await app.request(`${callbackPath}?code=oauth-code`, { headers: baseHeaders });

      expect(res.status).toBe(500);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_id_token' });
    });

    it('rejects invalid id token payloads', async () => {
      const tokens = createMockOauthTokens({
        claims: () => ({
          sub: 'only-sub',
        }),
      });
      oauthMock.authorizationCodeGrant.mockResolvedValueOnce(tokens);

      const res = await app.request(`${callbackPath}?code=oauth-code`, { headers: baseHeaders });

      expect(res.status).toBe(500);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_id_token' });
    });

    it('provisions a user and returns application tokens', async () => {
      const tokens = createMockOauthTokens({
        access_token: 'provider-access',
        refresh_token: 'provider-refresh',
        expires_in: 1234,
        scope: 'openid email profile',
        claims: () => ({
          sub: 'google-123',
          email: 'profile@example.com',
          name: 'Profile User',
          picture: 'https://example.com/image.png',
        }),
      });
      oauthMock.authorizationCodeGrant.mockResolvedValueOnce(tokens);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      prismaMock.user.findUnique.mockResolvedValueOnce(null);
      const createdUser = makePrismaUser({
        id: 'internal-user',
        name: 'Profile User',
        email: 'profile@example.com',
        image: 'https://example.com/image.png',
      });
      prismaMock.user.create.mockResolvedValueOnce(createdUser);

      const res = await app.request(`${callbackPath}?code=oauth-code`, { headers: baseHeaders });
      expect(res.status).toBe(200);

      const body = await readJson<{
        user: { id: string; email: string; name: string; image: string | null };
        accessToken: string;
        refreshToken: string;
      }>(res);

      expect(body.user).toStrictEqual({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        image: createdUser.image,
      });
      const accessPayload = await verifyToken(body.accessToken);
      const refreshPayload = await verifyToken(body.refreshToken, 'auth');
      expect(accessPayload.sub).toBe(createdUser.id);
      expect(refreshPayload.sub).toBe(createdUser.id);
      const lastCall = oauthMock.authorizationCodeGrant.mock.calls.at(-1);
      expect(lastCall?.[2]).toMatchObject({
        pkceCodeVerifier: 'stored-verifier',
        expectedState: 'stored-state',
      });
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          name: 'Profile User',
          email: 'profile@example.com',
          image: 'https://example.com/image.png',
          accounts: {
            create: [
              {
                provider: 'google',
                providerAccountId: 'google-123',
                accessToken: 'provider-access',
                refreshToken: 'provider-refresh',
                expiresAt: 1234,
                scope: 'openid email profile',
              },
            ],
          },
        },
      });
    });
  });
});

describe('auth.service.ts', () => {
  it('generates tokens with different audiences', async () => {
    const { accessToken, refreshToken } = await generateToken('service-user');

    const accessPayload = await verifyToken(accessToken);
    const refreshPayload = await verifyToken(refreshToken, 'auth');

    expect(accessPayload).toMatchObject({ aud: 'api', sub: 'service-user' });
    expect(refreshPayload).toMatchObject({ aud: 'auth', sub: 'service-user' });
  });

  it('fails verification when audience mismatches', async () => {
    const { refreshToken } = await generateToken('service-user');

    await expect(verifyToken(refreshToken)).rejects.toThrow();
  });
});
