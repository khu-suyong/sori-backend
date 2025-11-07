import { vi } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { IDToken, TokenEndpointResponse, TokenEndpointResponseHelpers } from 'openid-client';

export type MockOauthTokens = TokenEndpointResponse & TokenEndpointResponseHelpers;

export const createMockOauthTokens = (overrides: Partial<MockOauthTokens> = {}): MockOauthTokens => {
  const baseClaims = (): IDToken | undefined => ({
    sub: 'mock-oauth-user',
    email: 'oauth@example.com',
    name: 'OAuth Tester',
    picture: 'https://example.com/avatar.png',
    iss: '',
    aud: '',
    iat: 0,
    exp: 0
  });

  const tokens: TokenEndpointResponse = {
    access_token: 'oauth-access-token',
    refresh_token: 'oauth-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    scope: 'openid email profile',
  };
  const helper: TokenEndpointResponseHelpers = {
    claims: overrides.claims ?? baseClaims,
    expiresIn: overrides.expiresIn ?? (() => 3600),
  };

  return {
    ...tokens,
    ...helper,
    ...overrides,
  } as MockOauthTokens;
};

const defaultIssuer = { issuer: 'https://oauth.example' };

export const oauthMock = mockDeep<typeof import('openid-client')>();

const applyDefaults = () => {
  oauthMock.randomPKCECodeVerifier.mockReturnValue('pkce-verifier');
  oauthMock.calculatePKCECodeChallenge.mockResolvedValue('pkce-challenge');
  oauthMock.randomState.mockReturnValue('pkce-state');
  oauthMock.discovery.mockResolvedValue(defaultIssuer as any);
  oauthMock.buildAuthorizationUrl.mockImplementation((_config, params = {}) => {
    const url = new URL('https://oauth.example/authorize');
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    });
    return url;
  });
  oauthMock.authorizationCodeGrant.mockImplementation(async () => createMockOauthTokens());
};

applyDefaults();

vi.mock('openid-client', () => oauthMock);

export const resetOauthMock = () => {
  oauthMock.randomPKCECodeVerifier.mockReset();
  oauthMock.calculatePKCECodeChallenge.mockReset();
  oauthMock.randomState.mockReset();
  oauthMock.discovery.mockReset();
  oauthMock.buildAuthorizationUrl.mockReset();
  oauthMock.authorizationCodeGrant.mockReset();

  applyDefaults();
};
