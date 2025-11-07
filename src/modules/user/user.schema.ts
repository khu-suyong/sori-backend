import { z } from '@hono/zod-openapi';

import { BaseEntity, Entity } from '../common/common.schema';

export type Account = z.infer<typeof AccountSchema>;
export const AccountSchema = BaseEntity.extend({
  userId: z.string(),
  provider: z.string(),
  providerAccountId: z.string(),

  accessToken: z.string().nullable(),
  refreshToken: z.string().nullable(),
  expiresAt: z.number().nullable(),
  scope: z.string().nullable(),
});

export type User = z.infer<typeof UserSchema>;
export const UserSchema = Entity.extend({
  email: z.email(),
  name: z.string(),
  image: z.url().nullable(),
  accounts: AccountSchema.array(),
});

//

export type CreatableAccount = z.infer<typeof CreatableAccountSchema>;
export const CreatableAccountSchema = z.object({
  provider: z.string(),
  providerAccountId: z.string(),

  accessToken: z.string().nullable().optional(),
  refreshToken: z.string().nullable().optional(),
  expiresAt: z.number().nullable().optional(),
  scope: z.string().nullable().optional(),
});

export type CreatableUser = z.infer<typeof CreatableUserSchema>;
export const CreatableUserSchema = z.object({
  email: z.email(),
  name: z.string(),
  image: z.url().nullable(),
});

export type EditableUser = z.infer<typeof EditableUserSchema>;
export const EditableUserSchema = CreatableUserSchema.omit({
  email: true,
}).partial();

//

export type PublicUser = z.infer<typeof PublicUserSchema>;
export const PublicUserSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  image: true,
}).openapi('User');
