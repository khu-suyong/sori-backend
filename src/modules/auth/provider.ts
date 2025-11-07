import type { TokenEndpointResponse, TokenEndpointResponseHelpers } from 'openid-client';

type Tokens = Omit<TokenEndpointResponse, keyof TokenEndpointResponseHelpers> & TokenEndpointResponseHelpers;
export type AuthProvider = {
  buildAuthorizationUrl: (challenge: string, state: string) => URL;
  authorizationCodeGrant: (url: URL, verifier: string, state: string) => Promise<Tokens>;
};
export const createAuthProvider = <T extends AuthProvider>(provider: T): T => provider;
