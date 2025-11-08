import type { Folder as PrismaFolder } from '@prisma/client';

import { FolderSchema, type Folder, type PublicFolder } from './folder.schema';
import { toPublicNote } from '../note/note.mapper';

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
};
