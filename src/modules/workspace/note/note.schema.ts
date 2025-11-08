import { z } from '@hono/zod-openapi';

import { Entity, ID } from '../../common/common.schema';

export type Note = z.infer<typeof NoteSchema>;
export const NoteSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
});

//

export type CreatableNote = z.infer<typeof CreatableNoteSchema>;
export const CreatableNoteSchema = NoteSchema
  .pick({ name: true })
  .extend({
    folderId: ID.optional().openapi({ description: '노트를 생성할 폴더 ID' }),
  })
  .openapi('CreatableNote');

export type EditableNote = z.infer<typeof EditableNoteSchema>;
export const EditableNoteSchema = CreatableNoteSchema
  .partial()
  .extend({
    folderId: ID.nullable().optional().openapi({ description: '노트가 속할 폴더 ID. 최상위 노트로 변경 시 null' }),
  })
  .openapi('EditableNote');

//

export type PublicNote = z.infer<typeof PublicNoteSchema>;
export const PublicNoteSchema = NoteSchema
  .pick({ id: true, name: true })
  .openapi('Note');

