import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaClient, Server as PrismaServer, User as PrismaUser } from '@prisma/client';

import { app } from '../../src/app';
import { getTestPrisma } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';

const basePath = '/api/v1/server';
const serverPath = (suffix = '') => `${basePath}${suffix}`;
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
    email: overrides.email ?? `server-user-${userSeed}@example.com`,
    name: overrides.name ?? `Server User ${userSeed}`,
    image: overrides.image ?? null,
  },
});

let serverSeed = 1;
const createServerRecord = (userId: string, overrides: Partial<PrismaServer> = {}) => {
  const current = serverSeed++;
  return prisma.server.create({
    data: {
      id: overrides.id ?? makeId(4000 + current),
      userId,
      name: overrides.name ?? `Server-${current}`,
      url: overrides.url ?? `https://server-${current}.example.com`,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      updatedAt: overrides.updatedAt ?? null,
    },
  });
};

describe('server.route.ts', () => {
  describe('POST /api/v1/server', () => {
    it('requires Authorization header', async () => {
      const res = await app.request(serverPath(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Alpha', url: 'https://alpha.example.com' }),
      });

      expect(res.status).toBe(401);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
    });

    it('rejects unreachable server URLs before persisting', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 500 }));

      const res = await app.request(serverPath(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Bad Server', url: 'https://bad.example.com/' }),
      });

      expect(res.status).toBe(400);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_server_url' });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      await expect(prisma.server.count({ where: { userId: user.id } })).resolves.toBe(0);
    });

    it('creates a server after a successful health check', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 200 }));

      const res = await app.request(serverPath(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Primary', url: 'https://primary.example.com/' }),
      });

      expect(res.status).toBe(201);
      const body = await readJson<{ id: string; name: string; url: string }>(res);
      expect(body).toMatchObject({ name: 'Primary', url: 'https://primary.example.com/' });
      expect(fetchSpy).toHaveBeenCalledWith('https://primary.example.com/health');
      const stored = await prisma.server.findUnique({ where: { id: body.id } });
      expect(stored).not.toBeNull();
      expect(stored?.userId).toBe(user.id);
    });

    it('rejects duplicate server names per user', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(null, { status: 200 }));

      const payload = { name: 'Duplicated', url: 'https://dup.example.com' };
      const first = await app.request(serverPath(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(201);

      const second = await app.request(serverPath(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      expect(second.status).toBe(409);
      await expect(readJson<{ code: string }>(second)).resolves.toMatchObject({ code: 'server_already_exists' });
    });
  });

  describe('GET /api/v1/server', () => {
    it('requires Authorization header', async () => {
      const res = await app.request(serverPath());

      expect(res.status).toBe(401);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
    });

    it('returns only the requester servers alongside pagination metadata', async () => {
      const owner = await createUser();
      const other = await createUser();
      await createServerRecord(owner.id, { name: 'Owner Alpha', url: 'https://owner-alpha.example.com' });
      await createServerRecord(owner.id, { name: 'Owner Beta', url: 'https://owner-beta.example.com' });
      await createServerRecord(other.id, { name: 'Intruder Server' });
      const { accessToken } = await generateToken(owner.id);

      const res = await app.request(`${basePath}?limit=2`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(200);
      const body = await readJson<{
        items: Array<{ id: string; name: string; url: string }>;
        meta: { previous: string | null; next: string | null };
      }>(res);
      expect(body.items).toHaveLength(2);
      expect(body.items.every(item => item.name.startsWith('Owner'))).toBe(true);
      expect(body.meta.previous).toBe(body.items[0]?.id ?? null);
      expect(body.meta.next).toBe(body.items.at(-1)?.id ?? null);
    });
  });

  describe('GET /api/v1/server/:serverId', () => {
    it('returns 404 when the server does not exist', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${makeId(9999)}`), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'server_not_found' });
    });

    it('does not leak other users servers', async () => {
      const owner = await createUser();
      const intruder = await createUser();
      const server = await createServerRecord(owner.id);
      const { accessToken } = await generateToken(intruder.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'server_not_found' });
    });

    it('returns the requested server for its owner', async () => {
      const user = await createUser();
      const server = await createServerRecord(user.id, { name: 'Owned Server' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toMatchObject({
        id: server.id,
        name: 'Owned Server',
        url: server.url,
      });
    });
  });

  describe('PATCH /api/v1/server/:serverId', () => {
    it('returns 404 when the server is missing', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${makeId(5555)}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://updated.example.com' }),
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'server_not_found' });
    });

    it('blocks updates from non owners', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const server = await createServerRecord(owner.id, { url: 'https://locked.example.com' });
      const { accessToken } = await generateToken(stranger.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://intruder.example.com' }),
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.server.findUnique({ where: { id: server.id } });
      expect(stored?.url).toBe('https://locked.example.com');
    });

    it('updates the server URL for the owner', async () => {
      const user = await createUser();
      const server = await createServerRecord(user.id, { url: 'https://before.example.com' });
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://after.example.com' }),
      });

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toMatchObject({
        id: server.id,
        url: 'https://after.example.com',
      });
      const stored = await prisma.server.findUnique({ where: { id: server.id } });
      expect(stored?.url).toBe('https://after.example.com');
    });
  });

  describe('DELETE /api/v1/server/:serverId', () => {
    it('returns 404 when the server does not exist', async () => {
      const user = await createUser();
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${makeId(7777)}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(404);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'server_not_found' });
    });

    it('prevents non owners from deleting a server', async () => {
      const owner = await createUser();
      const stranger = await createUser();
      const server = await createServerRecord(owner.id);
      const { accessToken } = await generateToken(stranger.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(403);
      await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'no_permission' });
      const stored = await prisma.server.findUnique({ where: { id: server.id } });
      expect(stored).not.toBeNull();
    });

    it('deletes the server for its owner', async () => {
      const user = await createUser();
      const server = await createServerRecord(user.id);
      const { accessToken } = await generateToken(user.id);

      const res = await app.request(serverPath(`/${server.id}`), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      expect(res.status).toBe(204);
      const stored = await prisma.server.findUnique({ where: { id: server.id } });
      expect(stored).toBeNull();
    });
  });
});
