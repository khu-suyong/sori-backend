import { z } from '@hono/zod-openapi';

import { Entity } from '../common/common.schema';

export type Server = z.infer<typeof ServerSchema>;
export const ServerSchema = Entity.extend({
  userId: z.string().openapi({ description: '서버를 소유한 사용자 ID' }),

  name: z.string().openapi({ description: '서버 이름' }),
  url: z.url().openapi({ description: '서버 URL' }),
}).openapi('Server');

//

export type CreatableServer = z.infer<typeof CreatableServerSchema>;
export const CreatableServerSchema = z.object({
  name: z.string().min(1).openapi({ description: '서버 이름' }),
  url: z.url().openapi({ description: '서버 URL' }),
}).openapi('CreatableServer');

export type EditableServer = z.infer<typeof EditableServerSchema>;
export const EditableServerSchema = CreatableServerSchema.omit({ name: true }).partial().openapi('UpdatableServer');

//

export type PublicServer = z.infer<typeof PublicServerSchema>;
export const PublicServerSchema = ServerSchema.pick({
  id: true,
  name: true,
  url: true,
}).openapi('PublicServer');
