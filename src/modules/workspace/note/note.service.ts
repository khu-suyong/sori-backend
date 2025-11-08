import type { Prisma, PrismaClient } from '@prisma/client';

import type { CreatableNote, EditableNote } from './note.schema';

import { checkFolderPermission } from '../folder/folder.service';

export const checkNotePermission = async (
  prisma: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  noteId: string,
) => {
  const user = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
    },
  });
  if (!user) return false;

  const exist = await prisma.note.findFirst({
    where: {
      id: noteId,
      workspaceId,
    },
  });

  return !!exist;
};

type CreateNoteId = {
  userId: string;
  workspaceId: string;
};
export const createNote = async (
  prisma: PrismaClient,
  { userId, workspaceId }: CreateNoteId,
  input: CreatableNote,
) => {
  return prisma.$transaction(async (tx) => {
    const canAccess = await checkFolderPermission(tx, userId, workspaceId, input.folderId ?? null);
    if (!canAccess) return 'NoPermission';

    return tx.note.create({
      data: {
        name: input.name,
        workspaceId,
        folderId: input.folderId,
      },
    });
  });
};

export const fetchNote = async (
  prisma: Prisma.TransactionClient,
  noteId: string,
) => {
  return prisma.note.findFirst({
    where: {
      id: noteId,
    },
  });
};

type UpdateNoteId = {
  userId: string;
  workspaceId: string;
  noteId: string;
};
export const updateNote = async (
  prisma: PrismaClient,
  { userId, workspaceId, noteId }: UpdateNoteId,
  input: Partial<EditableNote>,
) => {
  return prisma.$transaction(async (tx) => {
    const note = await fetchNote(tx, noteId);
    if (!note) return 'NotFound';

    const canAccess = await checkNotePermission(prisma, userId, workspaceId, noteId);
    if (!canAccess) return 'NoPermission';

    return tx.note.update({
      where: {
        id: noteId,
      },
      data: {
        ...input,
      },
    });
  });
};

export const deleteNote = async (
  prisma: PrismaClient,
  { userId, workspaceId, noteId }: UpdateNoteId,
) => {
  return prisma.$transaction(async (tx) => {
    const note = await fetchNote(tx, noteId);
    if (!note) return 'NotFound';

    const canAccess = await checkNotePermission(tx, userId, workspaceId, noteId);
    if (!canAccess) return 'NoPermission';

    return tx.note.deleteMany({
      where: {
        id: noteId,
      },
    });
  });
};
