import { sign } from 'hono/jwt';

import type { PublicUser } from '../user/user.schema';

import { Env } from '../../lib/config';

export const generateToken = async (user: PublicUser) => {
  const [accessToken, refreshToken] = await Promise.all([
    sign(
      {
        iss: Env.APP_URL,
        aud: 'api',
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      Env.JWT_SECRET,
    ),
    sign(
      {
        iss: Env.APP_URL,
        aud: 'auth',
        sub: user.id,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30, // 30 days
      },
      Env.JWT_SECRET,
    ),
  ]);

  return { accessToken, refreshToken };
};
