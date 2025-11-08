import { describe, expect, it } from 'vitest';
import type { Folder as PrismaFolder, Note as PrismaNote, Workspace as PrismaWorkspace } from '@prisma/client';

import { app } from '../../src/app';
import { prismaMock } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';

const path = '/api/v1/workspace';
const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makeId = (seed: number) => `a${seed.toString().padStart(23, '0')}`;

type FolderWithRelations = PrismaFolder & {
  notes: PrismaNote[];
  children: FolderWithRelations[];
};
type WorkspaceWithRelations = PrismaWorkspace & {
  notes: PrismaNote[];
  folders: FolderWithRelations[];
};

const makeNote = (overrides: Partial<PrismaNote> = {}): PrismaNote => ({
  id: makeId(100),
  folderId: makeId(200),
  workspaceId: makeId(1),
  name: 'Note',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
});

const makeFolder = (overrides: Partial<FolderWithRelations> = {}): FolderWithRelations => ({
  id: makeId(300),
  workspaceId: makeId(1),
  parentId: null,
  name: 'Folder',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
  notes: [],
  children: [],
  ...overrides,
});

const makeWorkspace = (overrides: Partial<WorkspaceWithRelations> = {}): WorkspaceWithRelations => ({
  id: makeId(1),
  userId: makeId(999),
  name: 'Workspace',
  image: 'https://example.com/workspace.png',
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
  notes: [],
  folders: [],
  ...overrides,
});

const makeDeepFolderChain = (depth: number) => {
  const folderIds: string[] = [];
  const noteIds: string[] = [];

  const build = (level: number, parentId: string | null): FolderWithRelations => {
    const folderId = makeId(400 + level);
    const noteId = makeId(600 + level);
    folderIds.push(folderId);
    noteIds.push(noteId);

    return makeFolder({
      id: folderId,
      parentId,
      name: `Folder-${level}`,
      notes: [
        makeNote({
          id: noteId,
          folderId,
          name: `Note-${level}`,
        }),
      ],
      children: level < depth - 1 ? [build(level + 1, folderId)] : [],
    });
  };

  return {
    root: build(0, null),
    folderIds,
    noteIds,
  };
};

describe('workspace.route.ts', () => {
  it('returns 401 when the Authorization header is missing', async () => {
    const res = await app.request(path);

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
  });

  it('returns 401 for malformed Authorization headers', async () => {
    const res = await app.request(path, {
      headers: { Authorization: 'Token invalid' },
    });

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_authorization_header' });
  });

  it('returns sanitized workspaces with pagination metadata', async () => {
    const workspaceOne = makeWorkspace({
      id: makeId(1),
      userId: makeId(500),
      name: 'First Workspace',
      notes: [
        makeNote({
          id: makeId(10),
          name: 'Loose Note',
          workspaceId: makeId(1),
          folderId: makeId(20),
        }),
      ],
      folders: [
        makeFolder({
          id: makeId(20),
          name: 'Root Folder',
          notes: [
            makeNote({
              id: makeId(11),
              name: 'Folder Note',
              workspaceId: makeId(1),
              folderId: makeId(20),
            }),
          ],
          children: [
            makeFolder({
              id: makeId(21),
              parentId: makeId(20),
              name: 'Child Folder',
              notes: [
                makeNote({
                  id: makeId(12),
                  name: 'Nested Note',
                  workspaceId: makeId(1),
                  folderId: makeId(21),
                }),
              ],
              children: [],
            }),
          ],
        }),
      ],
    });
    const workspaceTwo = makeWorkspace({
      id: makeId(2),
      userId: workspaceOne.userId,
      name: 'Second Workspace',
      image: null,
    });
    prismaMock.workspace.findMany.mockResolvedValueOnce([workspaceOne, workspaceTwo]);

    const { accessToken } = await generateToken(workspaceOne.userId);
    const res = await app.request(`${path}?limit=2`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toStrictEqual({
      items: [
        {
          id: workspaceOne.id,
          name: workspaceOne.name,
          image: workspaceOne.image,
          notes: [
            { id: workspaceOne.notes[0].id, name: workspaceOne.notes[0].name },
          ],
          folders: [
            {
              id: workspaceOne.folders[0].id,
              name: workspaceOne.folders[0].name,
              notes: [
                { id: workspaceOne.folders[0].notes[0].id, name: workspaceOne.folders[0].notes[0].name },
              ],
              children: [
                {
                  id: workspaceOne.folders[0].children[0].id,
                  name: workspaceOne.folders[0].children[0].name,
                  notes: [
                    { id: workspaceOne.folders[0].children[0].notes[0].id, name: workspaceOne.folders[0].children[0].notes[0].name },
                  ],
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: workspaceTwo.id,
          name: workspaceTwo.name,
          image: workspaceTwo.image,
          notes: [],
          folders: [],
        },
      ],
      meta: {
        previous: workspaceOne.id,
        next: workspaceTwo.id,
      },
    });

    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
      where: { userId: workspaceOne.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        notes: true,
        folders: true,
      },
    });
  });

  it('passes pagination query parameters through to Prisma when cursor is provided', async () => {
    const workspace = makeWorkspace({ userId: makeId(600) });
    prismaMock.workspace.findMany.mockResolvedValueOnce([]);
    const { accessToken } = await generateToken(workspace.userId);
    const limit = 5;
    const cursor = makeId(42);

    const res = await app.request(`${path}?limit=${limit}&cursor=${cursor}&sortBy=name&orderBy=asc`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toStrictEqual({
      items: [],
      meta: {
        previous: null,
        next: null,
      },
    });
    expect(prismaMock.workspace.findMany).toHaveBeenCalledWith({
      where: { userId: workspace.userId },
      take: limit,
      skip: 1,
      cursor: { id: cursor },
      orderBy: { name: 'asc' },
      include: {
        notes: true,
        folders: true,
      },
    });
  });

  it('rejects invalid pagination queries', async () => {
    const { accessToken } = await generateToken(makeId(777));

    const res = await app.request(`${path}?limit=0`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(400);
    const body = await readJson<{ success: boolean; error?: { message?: string } }>(res);
    expect(body.success).toBe(false);
    expect(body.error?.message ?? '').toContain('"limit"');
    expect(prismaMock.workspace.findMany).not.toHaveBeenCalled();
  });

  it('returns multiple workspaces and omits next cursor on the last page', async () => {
    const userId = makeId(888);
    const workspaces = Array.from({ length: 3 }, (_, index) => makeWorkspace({
      id: makeId(50 + index),
      userId,
      name: `Workspace-${index}`,
    }));
    prismaMock.workspace.findMany.mockResolvedValueOnce(workspaces);
    const { accessToken } = await generateToken(userId);

    const res = await app.request(`${path}?limit=5`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await readJson<any>(res);
    expect(body.items).toHaveLength(3);
    expect(body.meta).toStrictEqual({
      previous: workspaces[0].id,
      next: null,
    });
  });

  it('serializes deeply nested folder trees without truncation', async () => {
    const depth = 6;
    const { root, folderIds, noteIds } = makeDeepFolderChain(depth);
    const userId = makeId(999);
    const workspace = makeWorkspace({
      id: makeId(88),
      userId,
      folders: [root],
    });
    prismaMock.workspace.findMany.mockResolvedValueOnce([workspace]);
    const { accessToken } = await generateToken(userId);

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await readJson<{ items: Array<{ folders: any[] }> }>(res);
    expect(body.items).toHaveLength(1);
    let current = body.items[0].folders[0];
    folderIds.forEach((folderId, index) => {
      expect(current.id).toBe(folderId);
      expect(current.notes[0].id).toBe(noteIds[index]);
      if (index < folderIds.length - 1) {
        expect(current.children).toHaveLength(1);
        current = current.children[0];
      } else {
        expect(current.children).toHaveLength(0);
      }
    });
  });

  it('returns a 500 error when workspace fetching fails', async () => {
    const userId = makeId(321);
    prismaMock.workspace.findMany.mockRejectedValueOnce(new Error('boom'));
    const { accessToken } = await generateToken(userId);

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(500);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'internal_server_error' });
  });
});
