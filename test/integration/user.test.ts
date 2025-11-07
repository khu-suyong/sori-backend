import { describe, expect, it } from 'vitest';

import type { PrismaClient, User as PrismaUser } from '@prisma/client';

import { app } from '../../src/app';
import { prismaMock } from '../mocks/db';
import { generateToken } from '../../src/modules/auth/auth.service';
import { fetchUser, putUser } from '../../src/modules/user/user.service';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;
const makePrismaUser = (overrides: Partial<PrismaUser> = {}): PrismaUser => ({
  id: 'user-id',
  email: 'user@example.com',
  name: 'User',
  image: null,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: null,
  ...overrides,
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
    const { accessToken } = await generateToken('missing-user');
    prismaMock.user.findUnique.mockResolvedValueOnce(null);

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(404);
    await expect(readJson<{ code: string }>(res)).resolves.toMatchObject({ code: 'user_not_found' });
  });

  it('returns a sanitized user payload for valid requests', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(makePrismaUser({
      id: 'user-id',
      name: 'Existing User',
      email: 'existing@example.com',
      image: null,
    }));
    const { accessToken } = await generateToken('user-id');

    const res = await app.request(path, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(res.status).toBe(200);
    await expect(readJson(res)).resolves.toStrictEqual({
      id: 'user-id',
      name: 'Existing User',
      email: 'existing@example.com',
      image: null,
    });
  });
});

describe('user.service.ts', () => {
  it('fetchUser delegates to prisma with expected filters', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(makePrismaUser({
      id: 'user-id',
      name: 'Test',
      email: 'foo@example.com',
      image: null,
    }));

    const result = await fetchUser(prismaMock, { id: 'user-id' });

    expect(result?.id).toBe('user-id');
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: {
        id: 'user-id',
        email: undefined,
        accounts: undefined,
      },
    });
  });

  it('putUser creates a user when one does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const createdUser = makePrismaUser({
      id: 'created-id',
      name: 'Created User',
      email: 'created@example.com',
      image: null,
    });
    prismaMock.user.create.mockResolvedValueOnce(createdUser);

    const result = await putUser(prismaMock as unknown as PrismaClient, {
      name: 'Created User',
      email: 'created@example.com',
      image: null,
    }, null);

    expect(result).toStrictEqual(createdUser);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Created User',
        email: 'created@example.com',
        image: null,
        accounts: undefined,
      },
    });
  });
});
