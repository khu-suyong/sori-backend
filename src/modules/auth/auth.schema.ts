import z from 'zod';

export const TokensSchema = z.object({
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
