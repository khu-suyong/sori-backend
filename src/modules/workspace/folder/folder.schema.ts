import { z } from '@hono/zod-openapi';

import { Entity } from '../../common/common.schema';
import { NoteSchema, PublicNoteSchema } from '../note/note.schema';

export type Folder = z.infer<typeof FolderSchema>;
export const FolderSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
  notes: NoteSchema.array(),
  get children() {
    return FolderSchema.array();
  },
});

//

export type CreatableFolder = z.infer<typeof CreatableFolderSchema>;
export const CreatableFolderSchema = z.object({
  name: z.string().min(1).max(50).openapi({ description: '폴더 이름' }),
  parentId: z.string().nullable().optional().openapi({ description: '상위 폴더 ID. 최상위 폴더인 경우 null' }),
});

export type EditableFolder = z.infer<typeof EditableFolderSchema>;
export const EditableFolderSchema = CreatableFolderSchema.partial();

//

export type PublicFolder = z.infer<typeof PublicFolderSchema>;
export const PublicFolderSchema = FolderSchema
  .pick({ id: true, name: true })
  .extend({
    notes: PublicNoteSchema.array(),
    get children() {
      return PublicFolderSchema.openapi({
        type: 'object',
        description: 'subfolder가 존재합니다. 일반적으로 1depth까지만 표시됩니다.',
      }).array();
    },
  })
  .openapi('Folder');