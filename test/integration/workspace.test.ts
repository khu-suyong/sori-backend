import { beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient, User as PrismaUser, Workspace as PrismaWorkspace } from '@prisma/client';

import { app } from '../../src/app';
import { getTestPrisma } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';

const basePath = '/api/v1/workspace';
const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makeId = (seed: number) => `a${seed.toString().padStart(23, '0')}`;

let prisma: PrismaClient;
beforeAll(() => {
  prisma = getTestPrisma();
});

let userSeed = 1;
const nextUserId = () => makeId(1000 + userSeed++);

const createUser = (overrides: Partial<PrismaUser> = {}) => prisma.user.create({
  data: {
    id: overrides.id ?? nextUserId(),
    email: overrides.email ?? `workspace-user-${userSeed}@example.com`,
    name: overrides.name ?? `Workspace User ${userSeed}`,
    image: overrides.image ?? null,
  },
});

let workspaceSeed = 1;
const nextWorkspaceId = () => makeId(2000 + workspaceSeed++);

const createWorkspace = (userId: string, overrides: Partial<PrismaWorkspace> = {}) => prisma.workspace.create({
  data: {
    id: overrides.id ?? nextWorkspaceId(),
    userId,
    name: overrides.name ?? `Workspace-${workspaceSeed}`,
    image: overrides.image ?? 'https://example.com/workspace.png',
  },
});

let folderSeed = 1;
let noteSeed = 1;

const createFolder = (workspaceId: string, parentId: string | null, name: string) => prisma.folder.create({
  data: {
    id: makeId(3000 + folderSeed++),
    workspaceId,
    parentId,
    name,
  },
});

const createNote = (workspaceId: string, folderId: string, name: string) => prisma.note.create({
  data: {
    id: makeId(4000 + noteSeed++),
    workspaceId,
    folderId,
    name,
  },
});

const createFolderChain = async (workspaceId: string, label: string, depth: number) => {
  const folderIds: string[] = [];
  let parentId: string | null = null;
  for (let level = 0; level < depth; level++) {
    const folder = await createFolder(workspaceId, parentId, `${label}-Folder-${level}`);
    folderIds.push(folder.id);
    await createNote(workspaceId, folder.id, `${label}-Note-${level}`);
    parentId = folder.id;
  }
  return folderIds;
};

const traverseFolderIds = (folder: { id: string; children: any[] }): string[] => {
  const ids: string[] = [];
  let current: { id: string; children: any[] } | undefined = folder;
  while (current) {
    ids.push(current.id);
    current = current.children[0];
  }
  return ids;
};

describe('workspace.route.ts:getWorkspaceRoute', () => {
  it('requires Authorization header', async () => {
    const res = await app.request(`${basePath}/${makeId(1)}`);

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
  });

  it('rejects malformed Authorization headers', async () => {
    const res = await app.request(`${basePath}/${makeId(1)}`, {
      headers: { Authorization: 'Token invalid' },
    });

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_authorization_header' });
  });

  it('returns 404 when the workspace does not exist', async () => {
    const user = await createUser();
    const { accessToken } = await generateToken(user.id);

    const res = await app.request(`${basePath}/${makeId(555)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'workspace_not_found' });
  });

  it('returns 404 when accessing another user’s workspace', async () => {
    const owner = await createUser({ name: 'Owner' });
    const intruder = await createUser({ name: 'Intruder' });
    const workspace = await createWorkspace(owner.id);
    const { accessToken } = await generateToken(intruder.id);

    const res = await app.request(`${basePath}/${workspace.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'workspace_not_found' });
  });

  it('returns a workspace with multiple deep branches', async () => {
    const user = await createUser();
    const workspace = await createWorkspace(user.id, { name: 'Branched Workspace' });
    const alphaChain = await createFolderChain(workspace.id, 'alpha', 4);
    const betaChain = await createFolderChain(workspace.id, 'beta', 3);
    const { accessToken } = await generateToken(user.id);

    const res = await app.request(`${basePath}/${workspace.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await readJson<{
      id: string;
      folders: Array<{ id: string; name: string; notes: Array<{ name: string }>; children: any[] }>;
    }>(res);
    expect(body.id).toBe(workspace.id);
    expect(body.folders).toHaveLength(2);

    const [alphaFolder, betaFolder] = body.folders;
    expect(alphaFolder.notes[0].name).toBe('alpha-Note-0');
    expect(betaFolder.notes[0].name).toBe('beta-Note-0');
    expect(traverseFolderIds(alphaFolder)).toHaveLength(alphaChain.length);
    expect(traverseFolderIds(betaFolder)).toHaveLength(betaChain.length);
  });

  it('handles folder chains that exceed ten levels deep', async () => {
    const user = await createUser();
    const workspace = await createWorkspace(user.id, { name: 'Deep Workspace' });
    const chain = await createFolderChain(workspace.id, 'deep', 12);
    const { accessToken } = await generateToken(user.id);

    const res = await app.request(`${basePath}/${workspace.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    const body = await readJson<{ folders: Array<{ id: string; children: any[] }> }>(res);
    expect(body.folders).toHaveLength(1);
    const ids = traverseFolderIds(body.folders[0]);
    expect(ids).toEqual(chain);
  });
});
