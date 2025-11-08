import { beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient, User as PrismaUser, Workspace as PrismaWorkspace, Folder as PrismaFolder } from '@prisma/client';

import { app } from '../../src/app';
import { getTestPrisma } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makeId = (seed: number) => `a${seed.toString().padStart(23, '0')}`;
const notePath = (workspaceId: string, suffix = '') => `/api/v1/workspace/${workspaceId}/note${suffix}`;

let prisma: PrismaClient;
beforeAll(() => {
  prisma = getTestPrisma();
});

let userSeed = 1;
const nextUserId = () => makeId(5000 + userSeed++);
const createUser = (overrides: Partial<PrismaUser> = {}) => prisma.user.create({
  data: {
    id: overrides.id ?? nextUserId(),
    email: overrides.email ?? `note-user-${userSeed}@example.com`,
    name: overrides.name ?? `Note User ${userSeed}`,
    image: overrides.image ?? null,
  },
});

let workspaceSeed = 1;
const nextWorkspaceId = () => makeId(6000 + workspaceSeed++);
const createWorkspace = (userId: string, overrides: Partial<PrismaWorkspace> = {}) => prisma.workspace.create({
  data: {
    id: overrides.id ?? nextWorkspaceId(),
    userId,
    name: overrides.name ?? `Note Workspace ${workspaceSeed++}`,
    image: overrides.image ?? null,
  },
});

let folderSeed = 1;
const nextFolderId = () => makeId(7000 + folderSeed++);
const createFolder = (workspaceId: string, overrides: Partial<PrismaFolder> = {}) => prisma.folder.create({
  data: {
    id: overrides.id ?? nextFolderId(),
    workspaceId,
    parentId: overrides.parentId ?? null,
    name: overrides.name ?? `Note Folder ${folderSeed}`,
  },
});

let noteSeed = 1;
const nextNoteId = () => makeId(8000 + noteSeed++);
const createNoteRecord = (workspaceId: string, folderId: string | null, overrides: { name?: string } = {}) => prisma.note.create({
  data: {
    id: nextNoteId(),
    workspaceId,
    folderId,
    name: overrides.name ?? `Note ${noteSeed}`,
  },
});

describe('note.route.ts', () => {
  describe('POST /api/v1/workspace/:workspaceId/note', () => {
    it('requires Authorization header', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolder(workspace.id);

      const res = await app.request(notePath(workspace.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Note', folderId: folder.id }),
      });

      expect(res.status).toBe(401);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
    });

    it('rejects creation when user lacks workspace permission', async () => {
      const owner = await createUser();
      const other = await createUser();
      const workspace = await createWorkspace(owner.id);
      const folder = await createFolder(workspace.id);
      const { accessToken } = await generateToken(other.id);

      const res = await app.request(notePath(workspace.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Intrusion', folderId: folder.id }),
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.note.findFirst({ where: { name: 'Intrusion' } });
      expect(stored).toBeNull();
    });

    it('creates a note for the workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolder(workspace.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(notePath(workspace.id), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Owner Note', folderId: folder.id }),
      });

      expect(res.status).toBe(201);
      const body = await readJson<{ id: string; name: string }>(res);
      expect(body.name).toBe('Owner Note');
      const stored = await prisma.note.findUnique({ where: { id: body.id } });
      expect(stored).not.toBeNull();
      expect(stored?.workspaceId).toBe(workspace.id);
      expect(stored?.folderId).toBe(folder.id);
    });
  });

  describe('PATCH /api/v1/workspace/:workspaceId/note/:noteId', () => {
    it('returns 404 when the note does not exist', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(notePath(workspace.id, `/${makeId(99999)}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Missing Note' }),
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'not_found' });
    });

    it('rejects updates from unauthorized users', async () => {
      const owner = await createUser();
      const other = await createUser();
      const workspace = await createWorkspace(owner.id);
      const folder = await createFolder(workspace.id);
      const note = await createNoteRecord(workspace.id, folder.id, { name: 'Original' });
      const { accessToken } = await generateToken(other.id);

      const res = await app.request(notePath(workspace.id, `/${note.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Hacked' }),
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.note.findUnique({ where: { id: note.id } });
      expect(stored?.name).toBe('Original');
    });

    it('updates a note for the workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolder(workspace.id);
      const note = await createNoteRecord(workspace.id, folder.id, { name: 'Old Title' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(notePath(workspace.id, `/${note.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'New Title' }),
      });

      expect(res.status).toBe(200);
      const body = await readJson<{ id: string; name: string }>(res);
      expect(body.id).toBe(note.id);
      expect(body.name).toBe('New Title');
      const stored = await prisma.note.findUnique({ where: { id: note.id } });
      expect(stored?.name).toBe('New Title');
    });
  });

  describe('DELETE /api/v1/workspace/:workspaceId/note/:noteId', () => {
    it('returns 404 when the note does not exist', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(notePath(workspace.id, `/${makeId(12345)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'not_found' });
    });

    it('rejects deletion attempts from other users', async () => {
      const owner = await createUser();
      const other = await createUser();
      const workspace = await createWorkspace(owner.id);
      const folder = await createFolder(workspace.id);
      const note = await createNoteRecord(workspace.id, folder.id, { name: 'Protected Note' });
      const { accessToken } = await generateToken(other.id);

      const res = await app.request(notePath(workspace.id, `/${note.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.note.findUnique({ where: { id: note.id } });
      expect(stored).not.toBeNull();
    });

    it('deletes a note for the workspace owner', async () => {
      const user = await createUser();
      const workspace = await createWorkspace(user.id);
      const folder = await createFolder(workspace.id);
      const note = await createNoteRecord(workspace.id, folder.id, { name: 'Disposable Note' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(notePath(workspace.id, `/${note.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(204);
      expect(await res.text()).toBe('');
      const stored = await prisma.note.findUnique({ where: { id: note.id } });
      expect(stored).toBeNull();
    });
  });
});
