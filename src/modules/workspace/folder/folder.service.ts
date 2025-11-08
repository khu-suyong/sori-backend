import type { Prisma, PrismaClient } from '@prisma/client';

import type { CreatableFolder, EditableFolder } from './folder.schema';

export const checkFolderPermission = async (
  prisma: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  folderId: string | null = null,
) => {
  const exist = await prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
      folders: folderId ? {
        some: {
          id: folderId,
        },
      } : undefined,
    },
  });

  return !!exist;
}

type CreateFolderId = {
  userId: string;
  workspaceId: string;
};
export const createFolder = async (
  prisma: PrismaClient,
  { userId, workspaceId }: CreateFolderId,
  input: CreatableFolder,
) => {
  return prisma.$transaction(async (tx) => {
    const canAccess = await checkFolderPermission(tx, userId, workspaceId);
    if (!canAccess) return 'NoPermission';

    return tx.folder.create({
      data: {
        workspaceId,
        name: input.name,
        parentId: input.parentId ?? null,
      },
    });
  });
};

export const fetchFolder = async (
  prisma: Prisma.TransactionClient,
  folderId: string,
) => {
  return prisma.folder.findFirst({
    where: {
      id: folderId,
    },
  });
};

type UpdateFolderId = {
  userId: string;
  workspaceId: string;
  folderId: string;
};
export const updateFolder = async (
  prisma: PrismaClient,
  { userId, workspaceId, folderId }: UpdateFolderId,
  input: Partial<EditableFolder>,
) => {
  return prisma.$transaction(async (tx) => {
    const folder = await fetchFolder(tx, folderId);
    if (!folder) return 'NotFound';

    const canAccess = await checkFolderPermission(prisma, userId, workspaceId, folderId);
    if (!canAccess) return 'NoPermission';

    return tx.folder.update({
      where: {
        id: folderId,
      },
      data: {
        ...input,
      },
    });
  });
};

export const deleteFolder = async (
  prisma: PrismaClient,
  { userId, workspaceId, folderId }: UpdateFolderId,
) => {
  return prisma.$transaction(async (tx) => {
    const folder = await fetchFolder(tx, folderId);
    if (!folder) return 'NotFound';

    const canAccess = await checkFolderPermission(tx, userId, workspaceId, folderId);
    if (!canAccess) return 'NoPermission';

    return tx.folder.deleteMany({
      where: {
        id: folderId,
      },
    });
  });
};
