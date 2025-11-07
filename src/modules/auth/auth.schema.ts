import { z } from '@hono/zod-openapi';

import { Env } from '../../lib/config';
import { PublicUserSchema } from '../user/user.schema';

export const OauthTokensSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
}).loose();

export type IdTokenUser = z.infer<typeof IdTokenUserSchema>;
export const IdTokenUserSchema = z.object({
  sub: z.string(),
  email: z.email(),
  email_verified: z.boolean().optional(),
  name: z.string(),
  picture: z.url().nullable().optional(),
}).loose();

//

export type AccessToken = z.infer<typeof AccessTokenSchema>;
export const AccessTokenSchema = z.object({
  iss: z.literal(Env.APP_URL),
  aud: z.literal('api'),
  sub: z.string(),
  iat: z.number(),
  exp: z.number(),
}).loose();

export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export const RefreshTokenSchema = z.object({
  iss: z.literal(Env.APP_URL),
  aud: z.literal('auth'),
  sub: z.string(),
  iat: z.number(),
  exp: z.number(),
}).loose();

export type Token = z.infer<typeof TokenSchema>;
export const TokenSchema = z.discriminatedUnion('aud', [AccessTokenSchema, RefreshTokenSchema]);

//

export const PublicTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
}).openapi('Token');

export const PublicTokenWithUserSchema = PublicTokenSchema.extend({
  user: PublicUserSchema,
}).openapi('TokenWithUser');
