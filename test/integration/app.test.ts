import { describe, expect, it } from 'vitest';

import { app } from '../../src/app';

const readJson = async <T>(res: Response) => res.json() as Promise<T>;

describe('app.ts', () => {
  describe('health route', () => {
    it('returns healthy payload', async () => {
      const res = await app.request('/api/v1/health');

      expect(res.status).toBe(200);
      await expect(readJson(res)).resolves.toStrictEqual({ ok: true });
    });
  });
});
