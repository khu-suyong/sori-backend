import type { Note as PrismaNote } from '@prisma/client';
import type { Note, PublicNote } from './note.schema';

export const toPublicNote = (note: Note | PrismaNote): PublicNote => {
  return {
    id: note.id,
    name: note.name,
  };
};
