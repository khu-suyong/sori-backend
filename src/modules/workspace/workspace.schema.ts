import { z } from '@hono/zod-openapi';
import { Entity } from '../common/common.schema';

export type Note = z.infer<typeof NoteSchema>;
export const NoteSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
});

export type Folder = z.infer<typeof FolderSchema>;
export const FolderSchema = Entity.extend({
  workspaceId: z.string(),

  name: z.string(),
  notes: NoteSchema.array(),
  get children() {
    return FolderSchema.array();
  },
});

export type Workspace = z.infer<typeof WorkspaceSchema>;
export const WorkspaceSchema = Entity.extend({
  name: z.string(),
  image: z.url().nullable(),
  notes: NoteSchema.array(),
  folders: FolderSchema.array(),
});

//

export type PublicNote = z.infer<typeof PublicNoteSchema>;
export const PublicNoteSchema = NoteSchema
  .pick({ id: true, name: true })
  .openapi('Note');

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

export type PublicWorkspace = z.infer<typeof PublicWorkspaceSchema>;
export const PublicWorkspaceSchema = WorkspaceSchema
  .pick({ id: true, name: true, image: true })
  .extend({
    notes: PublicNoteSchema.array(),
    folders: PublicFolderSchema.array(),
  })
  .openapi('Workspace');