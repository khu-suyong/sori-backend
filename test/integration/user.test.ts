import { beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient, User as PrismaUser } from '@prisma/client';

import { app } from '../../src/app';
import { getTestPrisma } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';
import { fetchUser, putUser } from '../../src/modules/user/user.service';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makeId = (seed: number) => `a${seed.toString().padStart(23, '0')}`;

let prisma: PrismaClient;
beforeAll(() => {
  prisma = getTestPrisma();
});

let userSeed = 1;
const nextUserId = () => makeId(userSeed++);

const createUser = (overrides: Partial<PrismaUser> = {}) => prisma.user.create({
  data: {
    id: overrides.id ?? nextUserId(),
    email: overrides.email ?? `user-${userSeed}@example.com`,
    name: overrides.name ?? 'User',
    image: overrides.image ?? null,
  },
});

describe('user.route.ts', () => {
  const path = '/api/v1/user';

  it('requires Authorization header', async () => {
    const res = await app.request(path);

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'missing_authorization_header' });
  });

  it('rejects malformed Authorization headers', async () => {
    const res = await app.request(path, {
      headers: { Authorization: 'Token invalid' },
    });

    expect(res.status).toBe(401);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'invalid_authorization_header' });
  });

  it('returns 404 when the user does not exist', async () => {
    const { accessToken } = await generateToken(makeId(999));

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'user_not_found' });
  });

  it('returns a sanitized user payload for valid requests', async () => {
    const user = await createUser({
      id: makeId(1),
      name: 'Existing User',
      email: 'existing@example.com',
      image: null,
    });
    const { accessToken } = await generateToken(user.id);

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toStrictEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
    });
  });
});

describe('user.service.ts', () => {
  it('fetchUser returns the user when filters match', async () => {
    const user = await createUser({
      id: makeId(10),
      name: 'Test',
      email: 'foo@example.com',
    });

    const result = await fetchUser(prisma, { id: user.id });

    expect(result?.id).toBe(user.id);
    expect(result?.email).toBe('foo@example.com');
  });

  it('putUser creates a user when one does not exist', async () => {
    const result = await putUser(prisma, {
      name: 'Created User',
      email: 'created@example.com',
      image: null,
    }, null);

    expect(result).toMatchObject({
      name: 'Created User',
      email: 'created@example.com',
      image: null,
    });

    const stored = await prisma.user.findUnique({ where: { email: 'created@example.com' } });
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe('Created User');
  });
});
