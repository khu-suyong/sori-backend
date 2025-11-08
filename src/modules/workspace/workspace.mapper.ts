import type { Folder as PrismaFolder, Note as PrismaNote, Workspace as PrismaWorkspace } from '@prisma/client';

import type { PublicWorkspace, Workspace } from './workspace.schema';
import { toPublicFolder } from './folder/folder.mapper';
import { toPublicNote } from './note/note.mapper';

type PrismaWorkspaceWithRelations = PrismaWorkspace & {
  notes: PrismaNote[];
  folders: PrismaFolder[];
};
export const toPublicWorkspace = (workspace: Workspace | PrismaWorkspaceWithRelations): PublicWorkspace => {
  return {
    id: workspace.id,
    name: workspace.name,
    image: workspace.image,
    notes: workspace.notes.map(toPublicNote),
    folders: workspace.folders.map(toPublicFolder),
  };
};
