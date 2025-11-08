import { z } from '@hono/zod-openapi';

import { NoteSchema, PublicNoteSchema } from './note/note.schema';
import { FolderSchema, PublicFolderSchema } from './folder/folder.schema';

import { Entity } from '../common/common.schema';

export type Workspace = z.infer<typeof WorkspaceSchema>;
export const WorkspaceSchema = Entity.extend({
  name: z.string(),
  image: z.url().nullable(),
  notes: NoteSchema.array(),
  folders: FolderSchema.array(),
});

//

export type CreatableWorkspace = z.infer<typeof CreatableWorkspaceSchema>;
export const CreatableWorkspaceSchema = z.object({
  name: z.string().min(1).max(50).openapi({ description: '워크스페이스 이름' }),
  image: z.url().nullable().optional().openapi({ description: '워크스페이스 이미지 URL' }),
}).openapi('CreatableWorkspace');

//

export type PublicWorkspace = z.infer<typeof PublicWorkspaceSchema>;
export const PublicWorkspaceSchema = WorkspaceSchema
  .pick({ id: true, name: true, image: true })
  .extend({
    notes: PublicNoteSchema.array(),
    folders: PublicFolderSchema.array(),
  })
  .openapi('Workspace');