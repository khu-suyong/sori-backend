import { z } from '@hono/zod-openapi';

import { Entity } from '../../common/common.schema';

export type Note = z.infer<typeof NoteSchema>;
export const NoteSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
});

//

export type PublicNote = z.infer<typeof PublicNoteSchema>;
export const PublicNoteSchema = NoteSchema
  .pick({ id: true, name: true })
  .openapi('Note');

