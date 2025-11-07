import { discovery, buildAuthorizationUrl, authorizationCodeGrant } from 'openid-client';

import { createAuthProvider } from './provider';

import { Env } from '../../lib/config';

const config = await discovery(
  new URL('https://accounts.google.com'),
  Env.GOOGLE_CLIENT_ID,
  Env.GOOGLE_CLIENT_SECRET,
);
export const google = createAuthProvider({
  buildAuthorizationUrl(challenge, state) {
    const redirectUri = Env.GOOGLE_CLIENT_REDIRECT_URI;
    const scope = 'openid email profile';

    return buildAuthorizationUrl(config, {
      redirect_uri: redirectUri,
      scope,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
  },
  async authorizationCodeGrant(url, verifier, state) {
    const tokens = await authorizationCodeGrant(config, url, {
      pkceCodeVerifier: verifier,
      expectedState: state,
    });

    return tokens;
  },
});
