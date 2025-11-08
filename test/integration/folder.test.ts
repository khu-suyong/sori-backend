import { beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient, User as PrismaUser, Workspace as PrismaWorkspace } from '@prisma/client';

import { app } from '../../src/app';
import { getTestPrisma } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makeId = (seed: number) => `a${seed.toString().padStart(23, '0')}`;
const folderPath = (workspaceId: string, suffix = '') => `/api/v1/workspace/${workspaceId}/folder${suffix}`;

let prisma: PrismaClient;
beforeAll(() => {
  prisma = getTestPrisma();
});

let userSeed = 1;
const nextUserId = () => makeId(1000 + userSeed++);
const createUser = (overrides: Partial<PrismaUser> = {}) => prisma.user.create({
  data: {
    id: overrides.id ?? nextUserId(),
    email: overrides.email ?? `folder-user-${userSeed}@example.com`,
    name: overrides.name ?? `Folder User ${userSeed}`,
    image: overrides.image ?? null,
  },
});

let workspaceSeed = 1;
const nextWorkspaceId = () => makeId(2000 + workspaceSeed++);
const createWorkspace = (userId: string, overrides: Partial<PrismaWorkspace> = {}) => prisma.workspace.create({
  data: {
    id: overrides.id ?? nextWorkspaceId(),
    userId,
    name: overrides.name ?? `Folder Workspace ${workspaceSeed++}`,
    image: overrides.image ?? null,
  },
});

let folderSeed = 1;
const nextFolderId = () => makeId(3000 + folderSeed++);
const createFolderRecord = (workspaceId: string, overrides: { parentId?: string | null; name?: string } = {}) => prisma.folder.create({
  data: {
    id: nextFolderId(),
    workspaceId,
    parentId: overrides.parentId ?? null,
    name: overrides.name ?? `Folder ${folderSeed}`,
  },
});

describe('folder.route.ts', () => {
  describe('POST /api/v1/workspace/:workspaceId/folder', () => {
    it('requires Authorization header', async () => {
      const owner = await createUser();
      const workspace = await createWorkspace(owner.id);

      const res = await app.request(folderPath(workspace.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Folder', parentId: null }),
      });

      expect(res.status).toBe(401);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
    });

    it('rejects unauthorized access to another user workspace', async () => {
      const owner = await createUser({ name: 'Owner' });
      const intruder = await createUser({ name: 'Intruder' });
      const workspace = await createWorkspace(owner.id);
      const { accessToken } = await generateToken(intruder.id);

      const res = await app.request(folderPath(workspace.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Unauthorized Folder', parentId: null }),
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.folder.findFirst({ where: { name: 'Unauthorized Folder' } });
      expect(stored).toBeNull();
    });

    it('creates a folder for workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(folderPath(workspace.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Primary Folder', parentId: null }),
      });

      expect(res.status).toBe(201);
      const body = await readJson<{ id: string; name: string; notes: unknown[]; children: unknown[] }>(res);
      expect(body.name).toBe('Primary Folder');
      expect(body.notes).toEqual([]);
      expect(body.children).toEqual([]);
      const stored = await prisma.folder.findUnique({ where: { id: body.id } });
      expect(stored).not.toBeNull();
      expect(stored?.workspaceId).toBe(workspace.id);
    });
  });

  describe('PATCH /api/v1/workspace/:workspaceId/folder/:folderId', () => {
    it('returns 404 when the target folder does not exist', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(folderPath(workspace.id, `/${makeId(99999)}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'folder_not_found' });
    });

    it('rejects updates from non workspace owners', async () => {
      const owner = await createUser();
      const other = await createUser();
      const workspace = await createWorkspace(owner.id);
      const folder = await createFolderRecord(workspace.id, { name: 'Owner Folder' });
      const { accessToken } = await generateToken(other.id);

      const res = await app.request(folderPath(workspace.id, `/${folder.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked Name' }),
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.folder.findUnique({ where: { id: folder.id } });
      expect(stored?.name).toBe('Owner Folder');
    });

    it('updates folder details for the workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolderRecord(workspace.id, { name: 'Old Name' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(folderPath(workspace.id, `/${folder.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      });

      expect(res.status).toBe(200);
      const body = await readJson<{ id: string; name: string }>(res);
      expect(body.id).toBe(folder.id);
      expect(body.name).toBe('Updated Name');
      const stored = await prisma.folder.findUnique({ where: { id: folder.id } });
      expect(stored?.name).toBe('Updated Name');
    });
  });

  describe('DELETE /api/v1/workspace/:workspaceId/folder/:folderId', () => {
    it('returns 404 when folder is missing', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(folderPath(workspace.id, `/${makeId(88888)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'folder_not_found' });
    });

    it('rejects deletion attempts from other users', async () => {
      const owner = await createUser();
      const other = await createUser();
      const workspace = await createWorkspace(owner.id);
      const folder = await createFolderRecord(workspace.id, { name: 'Protected Folder' });
      const { accessToken } = await generateToken(other.id);

      const res = await app.request(folderPath(workspace.id, `/${folder.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.folder.findUnique({ where: { id: folder.id } });
      expect(stored).not.toBeNull();
    });

    it('deletes folders for the workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolderRecord(workspace.id, { name: 'Disposable Folder' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(folderPath(workspace.id, `/${folder.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
      const stored = await prisma.folder.findUnique({ where: { id: folder.id } });
      expect(stored).toBeNull();
    });
  });
});
