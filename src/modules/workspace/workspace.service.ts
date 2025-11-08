import type { Prisma, Note as PrismaNote, Folder as PrismaFolder, PrismaClient } from '@prisma/client';
import type { PaginationQuery } from '../common/common.schema';
import type { CreatableWorkspace } from './workspace.schema';

type FetchWorkspacesOptions = PaginationQuery;
export const fetchWorkspaces = async (prisma: Prisma.TransactionClient, userId: string, options: FetchWorkspacesOptions = {}) => {
  const { cursor, limit = 20, orderBy = 'desc', sortBy = 'createdAt' } = options;

  if (cursor) {
    return prisma.workspace.findMany({
      where: { userId },
      take: limit,
      skip: 1,
      cursor: { id: cursor },
      orderBy: { [sortBy]: orderBy },
      include: {
        notes: true,
        folders: true,
      },
    });
  }

  return prisma.workspace.findMany({
    where: { userId },
    orderBy: { [sortBy]: orderBy },
    include: {
      notes: true,
      folders: true,
    },
  });
};
export const fetchWorkspace = async (
  prisma: Prisma.TransactionClient,
  userId: string,
  workspaceId: string,
  detailed = false,
) => {
  if (detailed) {
    const workspace = await prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        userId,
      },
    });
    if (!workspace) return null;

    type Row = PrismaFolder & {
      depth: number;

      noteId: string | null;
      noteName: string | null;
      noteFolderId: string | null;
      noteWorkspaceId: string | null;
      noteCreatedAt: Date | null;
      noteUpdatedAt: Date | null;
    };
    const rows = await prisma.$queryRaw<Row[]>`
WITH RECURSIVE f("id", "workspaceId", "parentId", "name", "createdAt", "updatedAt", "depth") AS (
  -- 루트
  SELECT "id", "workspaceId", "parentId", "name", "createdAt", "updatedAt", 0
  FROM "Folder"
  WHERE "workspaceId" = ${workspaceId} AND "parentId" IS NULL

  UNION ALL

  -- 하위
  SELECT c."id", c."workspaceId", c."parentId", c."name", c."createdAt", c."updatedAt", f."depth" + 1
  FROM "Folder" c
  JOIN f ON c."parentId" = f."id"
  WHERE c."workspaceId" = ${workspaceId}
)
SELECT
  f."id",
  f."workspaceId",
  f."parentId",
  f."name",
  f."createdAt",
  f."updatedAt",
  f."depth",
  n."id"          AS "noteId",
  n."folderId"    AS "noteFolderId",
  n."workspaceId" AS "noteWorkspaceId",
  n."name"        AS "noteName",
  n."createdAt"   AS "noteCreatedAt",
  n."updatedAt"   AS "noteUpdatedAt"
FROM f
LEFT JOIN "Note" n
  ON n."folderId" = f."id"
 AND n."workspaceId" = ${workspaceId}
ORDER BY f."depth", f."name", n."name" NULLS LAST;
    `;

    // 평면 → 트리
    type PrismaNestedFolder = PrismaFolder & {
      notes: PrismaNote[];
      children: PrismaNestedFolder[];
    };
    const byId = new Map<string, PrismaNestedFolder>();
    const folders: PrismaNestedFolder[] = [];

    // 폴더 노드 준비
    for (const r of rows) {
      if (!byId.has(r.id)) {
        byId.set(r.id, { ...r, notes: [], children: [] });
      }
    }
    // 노트 부착
    for (const r of rows) {
      if (r.noteId) {
        byId.get(r.id)!.notes.push({
          id: r.noteId,
          name: r.noteName!,
          folderId: r.noteFolderId!,
          workspaceId: r.noteWorkspaceId!,
          createdAt: r.noteCreatedAt!,
          updatedAt: r.noteUpdatedAt,
        });
      }
    }
    // 부모-자식 연결
    for (const r of rows) {
      const node = byId.get(r.id)!;
      if (r.parentId) {
        byId.get(r.parentId)!.children.push(node);
      } else if (!folders.includes(node)) {
        folders.push(node);
      }
    }
    // 정렬(형제: 이름, 노트: 이름)
    const sortTree = (n: PrismaNestedFolder) => {
      n.children.sort((a, b) => a.name.localeCompare(b.name));
      n.notes.sort((a, b) => a.name.localeCompare(b.name));
      n.children.forEach(sortTree);
    };
    folders.sort((a, b) => a.name.localeCompare(b.name));
    folders.forEach(sortTree);

    return {
      ...workspace,
      notes: rows
        .filter((r) => r.noteId !== null)
        .map((r) => ({
          id: r.noteId!,
          name: r.noteName!,
          folderId: r.noteFolderId!,
          workspaceId: r.noteWorkspaceId!,
          createdAt: r.noteCreatedAt!,
          updatedAt: r.noteUpdatedAt!,
        })),
      folders,
    };
  }

  return prisma.workspace.findFirst({
    where: {
      id: workspaceId,
      userId,
    },
    include: {
      notes: true,
      folders: true,
    },
  });
};

export const createWorkspace = async (prisma: PrismaClient, userId: string, input: CreatableWorkspace) => {
  return prisma.$transaction(async (tx) => {
    const exists = await fetchWorkspace(tx, userId, input.name);
    if (exists) return null;

    return prisma.workspace.create({
      data: {
        userId,
        name: input.name,
        image: input.image,
      },
      include: {
        notes: true,
        folders: true,
      },
    });
  });
};