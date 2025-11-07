import { sign, verify } from 'hono/jwt';

import { Env } from '../../lib/config';
import { AccessTokenSchema, RefreshTokenSchema, type AccessToken, type RefreshToken } from './auth.schema';

export const generateToken = async (userId: string) => {
  const [accessToken, refreshToken] = await Promise.all([
    sign(
      {
        iss: Env.APP_URL,
        aud: 'api',
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      } satisfies AccessToken,
      Env.JWT_SECRET,
    ),
    sign(
      {
        iss: Env.APP_URL,
        aud: 'auth',
        sub: userId,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
      } satisfies RefreshToken,
      Env.JWT_SECRET,
    ),
  ]);

  return { accessToken, refreshToken };
};

interface VerifyToken {
  (token: string, aud?: 'api'): Promise<AccessToken>;
  (token: string, aud: 'auth'): Promise<RefreshToken>;
}
export const verifyToken = (async (token: string, aud = 'api') => {
  const payload = await verify(token, Env.JWT_SECRET, {
    iss: Env.APP_URL,
    aud,
  });

  const Schema = aud === 'api' ? AccessTokenSchema : RefreshTokenSchema;
  const parsed = await Schema.spa(payload);
  if (!parsed.success) throw new Error('Invalid token payload');

  return parsed.data;
}) as VerifyToken;
