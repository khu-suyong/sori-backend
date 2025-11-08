import type { Folder as PrismaFolder, Note as PrismaNote, Workspace as PrismaWorkspace } from '@prisma/client';
import { type Folder, type Note, type Workspace, type PublicFolder, type PublicNote, type PublicWorkspace, FolderSchema } from './workspace.schema';

export const toPublicNote = (note: Note | PrismaNote): PublicNote => {
  return {
    id: note.id,
    name: note.name,
  };
};
export const toPublicFolder = (folder: Folder | PrismaFolder): PublicFolder => {
  const parsedFolder = FolderSchema.safeParse(folder);
  if (!parsedFolder.success) {
    return {
      id: folder.id,
      name: folder.name,
      notes: [],
      children: [],
    };
  }

  return {
    id: parsedFolder.data.id,
    name: parsedFolder.data.name,
    notes: parsedFolder.data.notes.map(toPublicNote),
    children: parsedFolder.data.children.map(toPublicFolder),
  };
}

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
